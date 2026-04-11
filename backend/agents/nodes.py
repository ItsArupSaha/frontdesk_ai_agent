"""
LangGraph node functions for the AI front-desk agent.

Each node processes one conversation turn and returns a partial state update.
The LangGraph runner merges partial updates into the cumulative AgentState.
"""
import asyncio

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from backend.agents.state import AgentState
from backend.agents.tools import build_tools
from backend.config import settings
from backend.utils.emergency import detect_emergency
from backend.utils.logging import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# LLM cache — one bound-tools instance per client_id to avoid rebuilding on
# every node invocation (ChatOpenAI + bind_tools is not free).
# ---------------------------------------------------------------------------
_llm_cache: dict[str, object] = {}


# Keywords that signal the last AI message was asking about a particular field.
_FIELD_KEYWORDS: dict[str, list[str]] = {
    "caller_name": ["your name", "get your name", "name please", "may i have your name"],
    "caller_phone": ["phone", "number", "reach you", "callback number", "best number"],
    "caller_address": ["address", "service address", "location", "where is"],
    "problem_description": [
        "problem", "issue", "describe", "what's wrong", "help with",
        "what can i help", "how can i help",
    ],
}


def _get_llm(client_config: dict):
    """Return a cached LLM bound with the standard tool set.

    The ChatOpenAI instance and its bound tools are built once per client_id
    and reused across all node calls within the process lifetime.
    """
    from langchain_openai import ChatOpenAI

    client_id = client_config.get("id", "")
    if client_id not in _llm_cache:
        api_key = settings.openai_api_key if settings.openai_api_key else "dummy"
        llm = ChatOpenAI(model="gpt-4o-mini", api_key=api_key)
        _llm_cache[client_id] = llm.bind_tools(build_tools(client_config, client_id))
    return _llm_cache[client_id]


def _last_user_message(messages: list) -> str | None:
    """Return the content of the most recent HumanMessage, or None."""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            return msg.content
    return None


def _last_ai_message(messages: list) -> str | None:
    """Return the content of the most recent AIMessage, or None."""
    for msg in reversed(messages):
        if isinstance(msg, AIMessage):
            return str(msg.content)
    return None


def _clean_extracted_value(raw: str, field: str) -> str:
    """Strip common preamble phrases from a user's answer.

    Callers often say "My name is John" instead of just "John".
    We clean the raw captured string so the stored value is the actual datum.
    """
    import re

    text = raw.strip()

    if field == "caller_name":
        # Remove "my name is / I'm / I am / this is / call me ..."
        text = re.sub(
            r"(?i)^(my name is|i'?m|i am|this is|call me|it'?s)\s+", "", text
        ).strip()

    elif field == "caller_phone":
        # Extract the first phone-like token (digits, +, -, spaces)
        m = re.search(r"[\+\d][\d\s\-\(\)]{6,}", text)
        if m:
            text = re.sub(r"\s+", "", m.group()).strip()

    elif field == "caller_address":
        # Remove "I'm at / I live at / my address is / located at ..."
        text = re.sub(
            r"(?i)^(i'?m at|i live at|my address is|located at|it'?s at|address is)\s+",
            "",
            text,
        ).strip()

    elif field == "problem_description":
        # Remove "I have a / there's a / my ... is ..."
        text = re.sub(
            r"(?i)^(i have (a |an )?|there'?s (a |an )?|it'?s (a |an )?)\s*",
            "",
            text,
        ).strip()

    return text if text else raw.strip()


def _try_extract_field(messages: list, field: str) -> str | None:
    """Search the full conversation history for a user answer to a field question.

    Walks all (AIMessage, HumanMessage) adjacent pairs in chronological order
    (most-recent first) and returns the user message that immediately followed
    an AI message containing the field's keywords.  Searching the full history
    (not just the last pair) handles cases where qualify_node asked a field
    question and the user answered before collect_info_node took over.
    """
    keywords = _FIELD_KEYWORDS.get(field, [])
    if not keywords:
        return None

    # Walk backwards through messages to find the most recent match
    for i in range(len(messages) - 1, 0, -1):
        if isinstance(messages[i], HumanMessage) and isinstance(messages[i - 1], AIMessage):
            ai_text = str(messages[i - 1].content).lower()
            user_text = messages[i].content
            if any(kw in ai_text for kw in keywords):
                return user_text
    return None


# ---------------------------------------------------------------------------
# Existing Phase 1 nodes
# ---------------------------------------------------------------------------


async def greeting_node(state: AgentState) -> dict:
    """Emit a static greeting and advance to the qualify turn.

    Emergency detection runs first so a caller who opens with "burst pipe"
    is immediately routed to emergency_node in the same webhook turn.
    For non-emergencies we return a static template (no LLM call) so this
    turn completes in under 1 second.
    """
    first_user_msg = _last_user_message(state["messages"])

    # Emergency check — must happen before any LLM call.
    if first_user_msg:
        detected, _ = detect_emergency(first_user_msg)
        if detected:
            # The graph conditional edge will route to emergency_node.
            return {"is_emergency": True, "current_node": "emergency"}

    business_name = state["client_config"].get("business_name", "our business")
    if first_user_msg:
        greeting_text = (
            f"Thank you for calling {business_name}! I'm Alex, your virtual assistant. "
            f"I heard you mention '{first_user_msg[:80]}' — let me help you with that. "
            "Could you give me a bit more detail?"
        )
    else:
        greeting_text = (
            f"Thank you for calling {business_name}! I'm Alex, your virtual assistant. "
            "How can I help you today?"
        )
    return {
        "messages": [AIMessage(content=greeting_text)],
        "current_node": "qualify",
    }


async def qualify_node(state: AgentState) -> dict:
    """Qualify the caller's intent and detect emergencies.

    Also sets current_node so the webhook can persist where to resume next
    turn — this is required because the greeting→qualify edge was removed to
    keep each webhook turn to a single LLM call.
    """
    # Emergency detection runs FIRST before any LLM call
    last_message = _last_user_message(state["messages"])
    is_emergency = state.get("is_emergency", False)

    if last_message and not is_emergency:
        detected, _ = detect_emergency(last_message)
        if detected:
            # Routing node will route to emergency node in same turn.
            # current_node stays "emergency" for any subsequent turns.
            return {"is_emergency": True, "current_node": "emergency"}

    business_name = state["client_config"].get("business_name", "our business")
    system_prompt = (
        f"You are Alex, the AI assistant for {business_name}. "
        "The caller has contacted us for service. Your job is to:\n"
        "1. Warmly acknowledge what the caller said.\n"
        "2. Confirm it sounds non-emergency and that you will help them book a visit.\n"
        "3. Ask ONE question only: 'To get you scheduled, may I start with your name?'\n\n"
        "IMPORTANT: Do NOT ask for their phone number, address, or calendar availability "
        "— a dedicated booking flow handles that next. "
        "Keep your response to 2 sentences maximum."
    )

    llm = _get_llm(state["client_config"])
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = await llm.ainvoke(messages)

    # Determine where the next webhook turn should start.
    if state.get("collection_complete"):
        next_node = "booking"
    else:
        next_node = "collect_info"

    return {"messages": [response], "current_node": next_node}


async def emergency_node(state: AgentState) -> dict:
    """Handle emergency situations by escalating the call immediately."""
    system_prompt = (
        "This is an emergency. Your ONLY job is to:\n"
        "1. Confirm you understand the emergency\n"
        "2. Tell the caller you are connecting them to a technician NOW\n"
        "3. Call the escalate_call tool immediately\n"
        "Do not ask more questions. Do not try to solve the problem. Act fast."
    )

    llm = _get_llm(state["client_config"])
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = await llm.ainvoke(messages)

    return {"messages": [response]}


# ---------------------------------------------------------------------------
# Phase 2 nodes
# ---------------------------------------------------------------------------


async def collect_info_node(state: AgentState) -> dict:
    """Collect the 4 required booking fields one at a time.

    Uses heuristic extraction from the conversation to update state fields,
    then asks for the next missing piece.  When all 4 fields are present,
    sets collection_complete=True and advances current_node to 'booking'.
    """
    messages = state["messages"]
    business_name = state["client_config"].get("business_name", "our business")

    # ------------------------------------------------------------------
    # 1. Try to extract missing fields from the latest conversation turn.
    # ------------------------------------------------------------------
    updates: dict = {}

    caller_name = state.get("caller_name")
    caller_phone = state.get("caller_phone")
    caller_address = state.get("caller_address")
    problem_description = state.get("problem_description")

    # ------------------------------------------------------------------
    # 1. Use the LLM to extract all fields from the full conversation in
    #    one structured-output call.  This replaces the fragile keyword
    #    heuristic which mis-assigns values when questions arrive out of
    #    order or the LLM rephrases them.
    # ------------------------------------------------------------------
    import re as _re
    from pydantic import BaseModel as _BM
    from langchain_openai import ChatOpenAI as _OAI

    class _Fields(_BM):
        caller_name: str | None = None
        caller_phone: str | None = None
        caller_address: str | None = None
        problem_description: str | None = None

    def _validate_extracted(field: str, value: str | None) -> str | None:
        """Accept extracted values only when they pass field-specific format checks.

        Rejects hallucinated values so a message like 'I need my AC fixed'
        cannot cause the extractor to invent a name, phone number, or address.
        """
        if not value:
            return None
        v = value.strip()
        if not v:
            return None
        if field == "caller_phone":
            # Must contain at least 7 digits (rules out hallucinated placeholders)
            if len(_re.sub(r"\D", "", v)) < 7:
                return None
        elif field == "caller_address":
            # Street addresses begin with a house/unit number
            if not _re.match(r"^\d+", v):
                return None
        elif field == "caller_name":
            # Must have at least 3 letters (rules out abbreviations like "AC")
            if len(_re.sub(r"[^a-zA-Z]", "", v)) < 3:
                return None
        # problem_description: accept any non-empty string ≥ 3 chars
        elif field == "problem_description":
            if len(v) < 3:
                return None
        return v

    extraction_prompt = (
        "Extract the following fields from the conversation below.\n"
        "Return ONLY values EXPLICITLY stated by the customer in their own words.\n"
        "Use null for ANY field the customer did not directly provide.\n\n"
        "Fields to extract:\n"
        "- caller_name: the customer's name (null if not stated)\n"
        "- caller_phone: the customer's phone number in E.164 format (null if not stated)\n"
        "- caller_address: the full service address (null if not stated)\n"
        "- problem_description: what is broken or what service is needed\n\n"
        "IMPORTANT: Do NOT infer, guess, or fill in missing information."
    )
    api_key = settings.openai_api_key if settings.openai_api_key else "dummy"
    extractor = _OAI(model="gpt-4o-mini", api_key=api_key).with_structured_output(_Fields)
    try:
        extracted: _Fields = await extractor.ainvoke(
            [SystemMessage(content=extraction_prompt)] + messages
        )
        if not caller_name:
            validated_name = _validate_extracted("caller_name", extracted.caller_name)
            if validated_name:
                caller_name = validated_name
                updates["caller_name"] = caller_name
        if not caller_phone:
            validated_phone = _validate_extracted("caller_phone", extracted.caller_phone)
            if validated_phone:
                caller_phone = validated_phone
                updates["caller_phone"] = caller_phone
        if not caller_address:
            validated_address = _validate_extracted("caller_address", extracted.caller_address)
            if validated_address:
                caller_address = validated_address
                updates["caller_address"] = caller_address
        if not problem_description:
            validated_problem = _validate_extracted("problem_description", extracted.problem_description)
            if validated_problem:
                problem_description = validated_problem
                updates["problem_description"] = problem_description
    except Exception as exc:
        logger.warning("Structured extraction failed, continuing", error=str(exc))

    # ------------------------------------------------------------------
    # 2. Check if collection is complete.
    # ------------------------------------------------------------------
    if all([caller_name, caller_phone, caller_address, problem_description]):
        updates["collection_complete"] = True
        updates["current_node"] = "booking"
        reply = AIMessage(
            content="Great, I have everything I need! Let me check available times for you."
        )
        updates["messages"] = [reply]
        return updates

    # ------------------------------------------------------------------
    # 3. Ask for the next missing field using the LLM.
    # ------------------------------------------------------------------
    collected_summary = (
        f"Name: {caller_name or 'NOT YET COLLECTED'}\n"
        f"Phone: {caller_phone or 'NOT YET COLLECTED'}\n"
        f"Address: {caller_address or 'NOT YET COLLECTED'}\n"
        f"Problem: {problem_description or 'NOT YET COLLECTED'}"
    )
    system_prompt = (
        f"You are collecting booking information for {business_name}.\n\n"
        f"Already collected:\n{collected_summary}\n\n"
        "Ask for ONE missing piece of information. Follow this order:\n"
        "1. Name (ask: 'Can I get your name?')\n"
        "2. Phone (ask: 'And what\\'s the best number to reach you?')\n"
        "3. Address (ask: 'What\\'s the service address?')\n"
        "4. Problem description (ask: 'Can you describe the issue briefly?')\n\n"
        "Be conversational and natural — do not sound like a form. "
        "Ask for exactly ONE field at a time. "
        "Respond ONLY with what to say to the customer."
    )

    llm = _get_llm(state["client_config"])
    llm_messages = [SystemMessage(content=system_prompt)] + messages
    response = await llm.ainvoke(llm_messages)

    updates["messages"] = [response]
    updates["current_node"] = "collect_info"
    return updates


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
    # 1. No slots yet — fetch from Google Calendar.
    # ------------------------------------------------------------------
    if not available_slots:
        # Detect date preference from conversation if any
        last_user = _last_user_message(messages) or ""
        date_preference = "this week"
        for pref in ("today", "tomorrow", "monday", "tuesday", "wednesday",
                     "thursday", "friday", "saturday"):
            if pref in last_user.lower():
                date_preference = pref
                break

        try:
            slots = await calendar_service.get_available_slots(
                client_id, date_preference
            )
        except CalendarNotConnectedError:
            logger.warning("Calendar not connected during booking", client_id=client_id)
            slots = []
        except (CalendarAPIError, Exception) as exc:
            logger.error("Calendar error during booking", client_id=client_id, error=str(exc))
            slots = []

        if not slots:
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
    last_user = (_last_user_message(messages) or "").lower()
    chosen_slot: dict | None = None

    # Ordinal words map to slot index
    _ORDINALS = {"first": 1, "second": 2, "third": 3, "1st": 1, "2nd": 2, "3rd": 3}

    # Match by slot number ([1], [2], [3]), ordinal words, or by label keywords
    for i, slot in enumerate(available_slots):
        slot_num = i + 1
        # Digit match: "1", "option 1", "[1]"
        if str(slot_num) in last_user:
            chosen_slot = slot
            break
        # Ordinal word match: "first", "second", "third"
        if any(ord_word in last_user and ord_val == slot_num for ord_word, ord_val in _ORDINALS.items()):
            chosen_slot = slot
            break
        # Label keyword match (day names, times)
        label_words = slot["label"].lower().split()
        for word in label_words:
            if len(word) > 3 and word in last_user:
                chosen_slot = slot
                break
        if chosen_slot:
            break

    if not chosen_slot:
        # Caller hasn't chosen yet — re-read options
        lines = ["Just to confirm — I have:"]
        for i, slot in enumerate(available_slots, 1):
            lines.append(f"[{i}] {slot['label']}")
        lines.append("Which would you like?")
        reply = AIMessage(content=" ".join(lines))
        return {"messages": [reply], "current_node": "booking"}

    # ------------------------------------------------------------------
    # 3. Book the chosen slot.
    # ------------------------------------------------------------------
    caller_details = {
        "name": caller_name,
        "phone": caller_phone,
        "address": caller_address,
        "problem_description": problem_description,
    }

    try:
        event = await calendar_service.book_appointment(client_id, chosen_slot, caller_details)
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
        """Synchronous helper: send SMS then persist booking row and call flag."""
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

        # DB writes (best effort)
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
        "chosen_slot": chosen_slot,
        "current_node": "booking",
    }


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------


def routing_node(state: AgentState) -> str:
    """Determine the next node after qualify based on current state.

    Routes to collect_info until all required fields are gathered
    (collection_complete=True), then to booking until confirmed.
    collection_complete is only set by collect_info_node after validated
    extraction, so hallucinated values cannot prematurely advance the state.
    """
    if state.get("is_emergency"):
        return "emergency"
    if not state.get("collection_complete"):
        return "collect_info"
    if not state.get("booking_complete"):
        return "booking"
    return "end"
