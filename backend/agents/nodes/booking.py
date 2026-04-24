"""booking_node — calendar availability check and appointment booking."""
import asyncio

from langchain_core.messages import AIMessage

from backend.agents.message_utils import last_user_message as _last_user_message
from backend.agents.state import AgentState
from backend.services import reminder_service
from backend.utils.logging import get_logger

logger = get_logger(__name__)


def _record_callback_request(
    client_id: str,
    caller_name: str | None,
    caller_phone: str | None,
    reason: str,
) -> None:
    """Queue a callback_request in reminders_queue. Best-effort — never raises."""
    if caller_phone:
        reminder_service.queue_callback_request(client_id, caller_name, caller_phone, reason)


async def booking_node(state: AgentState) -> dict:
    """Check calendar availability and complete appointment booking.

    - If no slots are stored yet: call get_available_slots and present options.
    - If slots are available: detect the caller's choice and book it.
    - On any calendar error: offer a callback instead.
    """
    from backend.services import calendar_service, sms_service
    from backend.services.calendar_service import (
        CalendarAPIError,
        CalendarBookingError,
        CalendarNotConnectedError,
    )

    messages = state["messages"]
    client_id = state.get("client_id", "")
    client_config = state["client_config"]
    business_name = client_config.get("business_name", "our business")

    caller_name = state.get("caller_name", "")
    caller_phone = state.get("caller_phone", "")
    caller_address = state.get("caller_address", "")
    problem_description = state.get("problem_description", "")

    available_slots: list = state.get("available_slots") or []

    # ------------------------------------------------------------------
    # 0. Check for cancellation or reschedule intent BEFORE slot matching.
    #    This handles B3 (caller changes mind) and B8 (reschedule request).
    #
    #    Cancellation is checked unconditionally (booking_node may be entered
    #    even when no cached slots exist — e.g. a follow-up "never mind" after
    #    collection_complete was set).
    #    Reschedule is only relevant when slots have already been offered.
    # ------------------------------------------------------------------
    _CANCEL_PHRASES = [
        "never mind", "nevermind", "cancel", "forget it",
        "don't worry", "no thanks", "i'll call back", "call back later",
        "call you back", "not anymore", "changed my mind",
    ]
    _RESCHEDULE_PHRASES = [
        "next week", "different day", "another day", "different time",
        "not this week", "later in the week", "reschedule",
        "change the day", "change the time",
    ]
    last_msg_for_intent = (_last_user_message(messages) or "").lower()
    # Cancellation — always checked so "never mind" works at any booking stage
    if any(phrase in last_msg_for_intent for phrase in _CANCEL_PHRASES):
        reply = AIMessage(
            content=(
                "No problem at all! Feel free to call us back whenever you're ready. "
                "Have a great day!"
            )
        )
        return {"messages": [reply], "current_node": "booking"}
    # Reschedule — only clear slots if we already offered some
    if available_slots and any(phrase in last_msg_for_intent for phrase in _RESCHEDULE_PHRASES):
        available_slots = []

    # ------------------------------------------------------------------
    # 1. No slots yet — fetch from Google Calendar.
    # ------------------------------------------------------------------
    if not available_slots:
        # Detect date preference from conversation if any
        last_user = _last_user_message(messages) or ""
        date_preference = "this week"
        for pref in ("today", "tomorrow", "monday", "tuesday", "wednesday",
                     "thursday", "friday", "saturday", "next week"):
            if pref in last_user.lower():
                date_preference = pref
                break

        tz = client_config.get("timezone", "America/New_York")
        duration_min = int(client_config.get("appointment_duration_minutes") or 60)
        try:
            slots = await calendar_service.get_available_slots(
                client_id, date_preference, duration_minutes=duration_min, timezone_str=tz
            )
        except CalendarNotConnectedError:
            logger.warning("Calendar not connected during booking", client_id=client_id)
            slots = []
        except (CalendarAPIError, Exception) as exc:
            logger.error("Calendar error during booking", client_id=client_id, error=str(exc))
            slots = []

        if not slots:
            # Record a callback request so the admin can follow up proactively.
            _record_callback_request(
                client_id=client_id,
                caller_name=caller_name,
                caller_phone=caller_phone,
                reason="No calendar slots available — caller needs appointment callback",
            )
            reply = AIMessage(
                content=(
                    "I'm having trouble accessing our calendar right now. "
                    "Let me have someone from the team call you back to confirm your appointment time. "
                    "Is that okay?"
                )
            )
            return {"messages": [reply], "current_node": "booking"}

        # Present slots to caller
        lines = [f"I have these times available for {business_name}:"]
        for i, slot in enumerate(slots, 1):
            lines.append(f"[{i}] {slot['label']}")
        lines.append("Which works best for you?")

        reply = AIMessage(content=" ".join(lines))
        return {
            "messages": [reply],
            "available_slots": slots,
            "current_node": "booking",
        }

    # ------------------------------------------------------------------
    # 2. Slots available — detect caller's choice from last user message.
    # ------------------------------------------------------------------
    import re as _re
    last_user = (_last_user_message(messages) or "").lower()
    chosen_slot: dict | None = None

    # Ordinal words map to slot index (1-based)
    _ORDINALS = {"first": 1, "second": 2, "third": 3, "1st": 1, "2nd": 2, "3rd": 3}

    # Collect ALL candidate matches — if >1 matches, caller was ambiguous.
    # We resolve in priority order: exact number > ordinal word > label keyword.
    # Label keyword matches accumulate; number/ordinal matches are definitive.

    # Priority 1 — exact number or ordinal (unambiguous by definition)
    for i, slot in enumerate(available_slots):
        slot_num = i + 1
        if _re.search(r"\b" + str(slot_num) + r"\b", last_user):
            chosen_slot = slot
            break
        for ord_word, ord_val in _ORDINALS.items():
            if ord_val == slot_num and _re.search(r"\b" + ord_word + r"\b", last_user):
                chosen_slot = slot
                break
        if chosen_slot:
            break

    # Priority 2 — label keyword match (may be ambiguous if multiple slots share a word)
    if not chosen_slot:
        label_matches: list[dict] = []
        for slot in available_slots:
            label_words = slot["label"].lower().split()
            for word in label_words:
                if len(word) > 3 and _re.search(r"\b" + _re.escape(word) + r"\b", last_user):
                    if slot not in label_matches:
                        label_matches.append(slot)
                    break

        if len(label_matches) == 1:
            chosen_slot = label_matches[0]
        elif len(label_matches) > 1:
            # Ambiguous — caller said something matching multiple slots.  Ask to clarify.
            lines = ["I want to make sure I pick the right one. Did you mean:"]
            for i, slot in enumerate(label_matches, 1):
                lines.append(f"[{i}] {slot['label']}")
            lines.append("Just say the number!")
            reply = AIMessage(content=" ".join(lines))
            return {"messages": [reply], "current_node": "booking"}

    if not chosen_slot:
        # Caller hasn't chosen yet — re-read options
        lines = ["Just to confirm — I have:"]
        for i, slot in enumerate(available_slots, 1):
            lines.append(f"[{i}] {slot['label']}")
        lines.append("Which would you like?")
        reply = AIMessage(content=" ".join(lines))
        return {"messages": [reply], "current_node": "booking"}

    # ------------------------------------------------------------------
    # 3. Duplicate booking guard — prevent double-booking the same phone.
    # ------------------------------------------------------------------
    if caller_phone:
        try:
            from backend.db.client import get_supabase as _get_sb
            dup_res = (
                _get_sb().table("bookings")
                .select("id, appointment_start")
                .eq("client_id", client_id)
                .eq("caller_phone", caller_phone)
                .eq("status", "confirmed")
                .limit(1)
                .execute()
            )
            if dup_res.data:
                existing = dup_res.data[0]
                reply = AIMessage(
                    content=(
                        f"It looks like there's already a confirmed appointment booked for your number "
                        f"at {existing.get('appointment_start', 'a time we have on file')}. "
                        "If you'd like to change or cancel it, please call us directly."
                    )
                )
                return {"messages": [reply], "current_node": "booking"}
        except Exception as exc:
            logger.warning("Duplicate booking check failed — proceeding", client_id=client_id, error=str(exc))

    # ------------------------------------------------------------------
    # 4. Book the chosen slot.
    # ------------------------------------------------------------------
    caller_details = {
        "name": caller_name,
        "phone": caller_phone,
        "address": caller_address,
        "problem_description": problem_description,
    }

    tz = client_config.get("timezone", "America/New_York")
    try:
        event = await calendar_service.book_appointment(client_id, chosen_slot, caller_details, timezone_str=tz)
        google_event_id = event.get("id")
    except (CalendarBookingError, Exception) as exc:
        logger.error("Booking failed", client_id=client_id, error=str(exc))
        reply = AIMessage(
            content=(
                "I had trouble confirming that slot. Let me have someone call you "
                "right back to lock in your appointment."
            )
        )
        return {"messages": [reply], "current_node": "booking"}

    # Calendar event is confirmed. Fire SMS + DB writes as background tasks so
    # we return the verbal confirmation to Vapi immediately — well within the
    # 4-second timeout. Both tasks are best-effort and log their own errors.
    call_id_bg = state.get("call_id")

    def _sms_and_db() -> None:
        """Synchronous helper: send SMS then persist booking row, call flag, and reminders."""
        # SMS (never raises — sms_service handles its own exceptions)
        sms_service.send_booking_confirmation(
            booking_details={
                "caller_name": caller_name,
                "caller_phone": caller_phone,
                "appointment_label": chosen_slot["label"],
                "business_name": business_name,
            },
            client_config=client_config,
        )

        # DB writes — if bookings insert fails, roll back the Google Calendar event
        # so the calendar and our DB stay in sync.
        try:
            from backend.db.client import get_supabase
            supabase = get_supabase()
            supabase.table("bookings").insert({
                "client_id": client_id,
                "call_id": call_id_bg,
                "caller_name": caller_name,
                "caller_phone": caller_phone,
                "caller_address": caller_address,
                "problem_description": problem_description,
                "appointment_start": chosen_slot["start"],
                "appointment_end": chosen_slot["end"],
                "google_event_id": google_event_id,
                "confirmation_sms_sent": True,
                "status": "confirmed",
            }).execute()
            supabase.table("call_logs").update({"was_booked": True}).eq(
                "call_id", call_id_bg
            ).execute()
        except Exception as exc:
            logger.error("Failed to persist booking to DB", client_id=client_id, error=str(exc))
            # Roll back the Google Calendar event so it doesn't stay as a ghost appointment.
            if google_event_id:
                try:
                    from backend.services.calendar_service import delete_event_sync
                    delete_event_sync(client_id, google_event_id)
                except Exception as del_exc:
                    logger.error(
                        "Calendar rollback also failed — manual cleanup needed",
                        client_id=client_id,
                        google_event_id=google_event_id,
                        error=str(del_exc),
                    )

        # Queue 24h reminder only. Review request is NOT auto-queued here —
        # it fires when the admin marks the booking as "completed" in the dashboard.
        reminder_service.queue_booking_reminder(
            client_id=client_id,
            caller_phone=caller_phone,
            business_name=business_name,
            appointment_label=chosen_slot["label"],
            caller_address=caller_address,
            appointment_start=chosen_slot["start"],
        )

    # Schedule as a background task — do not await it
    asyncio.create_task(asyncio.to_thread(_sms_and_db))

    reply = AIMessage(
        content=(
            f"Perfect! I've booked you in for {chosen_slot['label']}. "
            "You'll receive a text confirmation shortly. "
            "Is there anything else I can help with?"
        )
    )
    return {
        "messages": [reply],
        "booking_complete": True,
        "call_outcome": "booked",
        "chosen_slot": chosen_slot,
        "current_node": "booking",
    }
