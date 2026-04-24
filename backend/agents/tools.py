"""
LangChain tool definitions for the AI front-desk agent.
Tools are built as closures so they capture client_id and client_config
without needing them as explicit parameters (LLM doesn't know these internals).
"""
from langchain_core.tools import tool

from backend.utils.logging import get_logger

logger = get_logger(__name__)


def build_tools(client_config: dict, client_id: str = ""):
    """Return the list of tools bound to the current client context.

    Args:
        client_config: Runtime client configuration dict.
        client_id: Internal client UUID (used by calendar/SMS tools).
    """

    @tool
    def escalate_call(reason: str, caller_summary: str) -> dict:
        """Escalates the call to a human operator or emergency line.
        Requires exactly 'reason' (string) and 'caller_summary' (string).
        """
        return {
            "action": "transfer",
            "phone": client_config.get("emergency_phone_number", ""),
            "summary": caller_summary,
            "reason": reason,
        }

    @tool
    def get_business_info(question: str) -> str:
        """Answers queries about the business, services offered, hours, and service area.

        Uses the RAG knowledge base to retrieve the most relevant business-specific
        information for the caller's question. Falls back to raw config when the
        knowledge base has no matching chunks.
        """
        import asyncio
        from backend.services.rag_service import query_knowledge

        # Only run RAG when we have a real client_id
        if client_id:
            try:
                loop = asyncio.get_event_loop()
                context = loop.run_until_complete(
                    query_knowledge(client_id, question, top_k=3)
                )
                if context:
                    return context
            except Exception as exc:
                logger.warning("RAG query failed, falling back to config", error=str(exc))

        # Fallback: assemble answer directly from config dict
        services = ", ".join(client_config.get("services_offered", []))
        return (
            f"Business: {client_config.get('business_name')}. "
            f"Hours: {client_config.get('working_hours')}. "
            f"Services: {services}. "
            f"Area: {client_config.get('service_area_description')}."
        )

    @tool
    def end_call_gracefully(reason: str) -> str:
        """Ends the call gracefully with a polite goodbye message."""
        if reason == "out_of_area":
            return "I'm sorry, but we don't service that area. Have a great day!"
        elif reason == "not_a_service_we_offer":
            return "I'm sorry, but we don't offer that service. Goodbye."
        return "Thank you for calling. We will be in touch. Goodbye."

    @tool
    def check_calendar(date_preference: str) -> str:
        """Check available appointment slots on Google Calendar.

        Args:
            date_preference: Natural language date preference from the caller
                ('today', 'tomorrow', 'this week', 'Monday', etc.).
        """
        import asyncio
        from backend.services.calendar_service import (
            CalendarNotConnectedError,
            CalendarAPIError,
            get_available_slots,
        )

        try:
            loop = asyncio.get_event_loop()
            slots = loop.run_until_complete(
                get_available_slots(client_id, date_preference)
            )
        except CalendarNotConnectedError:
            logger.warning("Calendar not connected", client_id=client_id)
            return (
                "Let me have someone call you back to confirm the appointment."
            )
        except (CalendarAPIError, Exception) as exc:
            logger.error("Calendar check failed", client_id=client_id, error=str(exc))
            return (
                "Let me have someone call you back to confirm the appointment."
            )

        if not slots:
            return (
                "I don't see any openings in that timeframe. "
                "Let me check with the team and have someone call you back to schedule."
            )

        lines = ["I have these times available:"]
        for i, slot in enumerate(slots, 1):
            lines.append(f"[{i}] {slot['label']}")
        lines.append("Which works best for you?")
        return " ".join(lines)

    @tool
    def book_appointment(
        slot_label: str,
        slot_start: str,
        slot_end: str,
        caller_name: str,
        caller_phone: str,
        caller_address: str,
        problem_description: str,
    ) -> str:
        """Book a confirmed appointment on Google Calendar and send SMS confirmation.

        Args:
            slot_label: Human-readable label for the chosen slot (e.g. 'Monday at 10am').
            slot_start: ISO datetime string for slot start.
            slot_end: ISO datetime string for slot end.
            caller_name: Customer's full name.
            caller_phone: Customer's phone number in E.164 format.
            caller_address: Service address.
            problem_description: Description of the issue to be fixed.
        """
        import asyncio
        from datetime import datetime
        from backend.services.calendar_service import (
            CalendarBookingError,
            book_appointment as cal_book,
        )
        from backend.services import sms_service
        from backend.services import fsm_service
        from backend.db.models import Booking

        slot = {"start": slot_start, "end": slot_end, "label": slot_label}
        caller_details = {
            "name": caller_name,
            "phone": caller_phone,
            "address": caller_address,
            "problem_description": problem_description,
        }

        try:
            loop = asyncio.get_event_loop()
            loop.run_until_complete(cal_book(client_id, slot, caller_details))
        except CalendarBookingError as exc:
            logger.error("Calendar booking failed", client_id=client_id, error=str(exc))
            return (
                "I had trouble confirming that slot. Let me have someone call you "
                "right back to lock in your appointment."
            )
        except Exception as exc:
            logger.error("Unexpected booking error", client_id=client_id, error=str(exc))
            return (
                "I had trouble confirming that slot. Let me have someone call you "
                "right back to lock in your appointment."
            )

        # Send SMS confirmation (never raises)
        business_name = client_config.get("business_name", "us")
        sms_service.send_booking_confirmation(
            booking_details={
                "caller_name": caller_name,
                "caller_phone": caller_phone,
                "appointment_label": slot_label,
                "business_name": business_name,
            },
            client_config=client_config,
        )

        # Kick off FSM sync as a background coroutine (fire-and-forget, never raises)
        try:
            booking = Booking(
                client_id=client_id,
                caller_name=caller_name,
                caller_phone=caller_phone,
                caller_address=caller_address,
                problem_description=problem_description,
                appointment_start=datetime.fromisoformat(slot_start),
                appointment_end=datetime.fromisoformat(slot_end),
            )
            loop = asyncio.get_event_loop()
            loop.run_until_complete(
                fsm_service.sync_booking_to_fsm(booking, client_config)
            )
        except Exception as exc:
            logger.error("FSM sync dispatch failed", client_id=client_id, error=str(exc))

        # Queue 24h reminder only. Review request is NOT auto-queued —
        # it fires when admin marks booking as "completed" in the dashboard.
        try:
            from backend.services import reminder_service
            reminder_service.queue_booking_reminder(
                client_id=client_id,
                caller_phone=caller_phone,
                business_name=business_name,
                appointment_label=slot_label,
                caller_address=caller_address,
                appointment_start=slot_start,
            )
        except Exception as exc:
            logger.error("Failed to queue booking reminder", client_id=client_id, error=str(exc))

        return (
            f"Perfect! I've booked you in for {slot_label}. "
            "You'll receive a text confirmation shortly. "
            "Is there anything else I can help with?"
        )

    @tool
    def create_fsm_record(
        caller_name: str,
        caller_phone: str,
        caller_address: str,
        problem_description: str,
        appointment_start: str,
        appointment_end: str,
    ) -> str:
        """Sync a confirmed booking to the client's field service management system.

        Calls Jobber or Housecall Pro depending on the client's configuration.
        This is best-effort — failure does not affect the booking confirmation.

        Args:
            caller_name: Customer's full name.
            caller_phone: Customer's phone number in E.164 format.
            caller_address: Service address.
            problem_description: Description of the work requested.
            appointment_start: ISO datetime string for appointment start.
            appointment_end: ISO datetime string for appointment end.
        """
        import asyncio
        from datetime import datetime
        from backend.services import fsm_service
        from backend.db.models import Booking

        fsm_type = client_config.get("fsm_type")
        if not fsm_type:
            return "No FSM configured for this client — skipping sync."

        try:
            booking = Booking(
                client_id=client_id,
                caller_name=caller_name,
                caller_phone=caller_phone,
                caller_address=caller_address,
                problem_description=problem_description,
                appointment_start=datetime.fromisoformat(appointment_start),
                appointment_end=datetime.fromisoformat(appointment_end),
            )
            loop = asyncio.get_event_loop()
            loop.run_until_complete(
                fsm_service.sync_booking_to_fsm(booking, client_config)
            )
        except Exception as exc:
            logger.error("create_fsm_record tool failed", client_id=client_id, error=str(exc))
            return f"FSM sync encountered an error: {exc}"

        return f"Booking synced to {fsm_type} successfully."

    @tool
    def request_callback(caller_name: str, caller_phone: str, reason: str) -> str:
        """Request a manual callback when calendar is unavailable or caller prefers it.

        Args:
            caller_name: Customer's name.
            caller_phone: Customer's phone number.
            reason: Reason for the callback request.
        """
        from datetime import datetime, timezone
        from backend.db.client import get_supabase

        try:
            supabase = get_supabase()
            # Queue as a callback_request in reminders_queue so the admin sees it
            # in the dashboard and can action it. Scheduled immediately (now) so the
            # scheduler surfaces it to the admin within minutes.
            msg = (
                f"CALLBACK REQUEST — {caller_name} ({caller_phone}): {reason}"
            )
            supabase.table("reminders_queue").insert({
                "client_id": client_id,
                "type": "callback_request",
                "to_number": caller_phone,
                "scheduled_for": datetime.now(timezone.utc).isoformat(),
                "message_body": msg,
            }).execute()
        except Exception as exc:
            logger.error("Failed to save callback request", client_id=client_id, error=str(exc))

        return (
            f"Got it, {caller_name}. Someone from our team will call you back "
            f"at {caller_phone} as soon as possible."
        )

    return [
        escalate_call,
        get_business_info,
        end_call_gracefully,
        check_calendar,
        book_appointment,
        request_callback,
        create_fsm_record,
    ]
