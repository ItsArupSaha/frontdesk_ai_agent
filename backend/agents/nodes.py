"""
LangGraph node functions for the AI front-desk agent.

Each node processes one conversation turn and returns a partial state update.
The LangGraph runner merges partial updates into the cumulative AgentState.
"""
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from backend.agents.state import AgentState
from backend.agents.tools import build_tools
from backend.config import settings
from backend.utils.emergency import detect_emergency
from backend.utils.logging import get_logger

logger = get_logger(__name__)

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
    """Build an LLM bound with the standard tool set."""
    from langchain_openai import ChatOpenAI

    api_key = settings.openai_api_key if settings.openai_api_key else "dummy"
    client_id = client_config.get("id", "")
    llm = ChatOpenAI(model="gpt-4o-mini", api_key=api_key)
    return llm.bind_tools(build_tools(client_config, client_id))


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


def _try_extract_field(messages: list, field: str) -> str | None:
    """If the last AI message asked for `field`, return the user's last response.

    This is a heuristic: we look for field-specific keywords in the last AI
    message and, if found, treat the subsequent user message as the answer.
    """
    last_ai = _last_ai_message(messages)
    last_user = _last_user_message(messages)

    if not last_ai or not last_user:
        return None

    keywords = _FIELD_KEYWORDS.get(field, [])
    if any(kw in last_ai.lower() for kw in keywords):
        return last_user
    return None


# ---------------------------------------------------------------------------
# Existing Phase 1 nodes
# ---------------------------------------------------------------------------


async def greeting_node(state: AgentState) -> dict:
    """Generate the initial greeting for the caller."""
    business_name = state["client_config"].get("business_name", "our business")
    system_prompt = (
        f"You are Alex, the AI assistant for {business_name}. "
        "You answer calls professionally, qualify the caller's needs, "
        "and help them book appointments or get urgent help. "
        "Always be warm but efficient — these are busy tradespeople's customers."
    )

    llm = _get_llm(state["client_config"])
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = await llm.ainvoke(messages)

    return {"messages": [response], "current_node": "qualify"}


async def qualify_node(state: AgentState) -> dict:
    """Qualify the caller's intent and detect emergencies."""
    # Emergency detection runs FIRST before any LLM call
    last_message = _last_user_message(state["messages"])
    is_emergency = state.get("is_emergency", False)

    if last_message and not is_emergency:
        detected, _ = detect_emergency(last_message)
        if detected:
            return {"is_emergency": True}

    business_name = state["client_config"].get("business_name", "our business")
    system_prompt = (
        f"You are Alex, the AI assistant for {business_name}. "
        "Ask qualifying questions:\n"
        "1. What is the problem?\n"
        "2. What is the address / are you in our service area?\n"
        "3. How urgent is this?\n\n"
        "Do not ask all 3 at once — one question per turn."
    )

    llm = _get_llm(state["client_config"])
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = await llm.ainvoke(messages)

    return {"messages": [response]}


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

    if not caller_name:
        extracted = _try_extract_field(messages, "caller_name")
        if extracted:
            caller_name = extracted
            updates["caller_name"] = caller_name

    if not caller_phone:
        extracted = _try_extract_field(messages, "caller_phone")
        if extracted:
            caller_phone = extracted
            updates["caller_phone"] = caller_phone

    if not caller_address:
        extracted = _try_extract_field(messages, "caller_address")
        if extracted:
            caller_address = extracted
            updates["caller_address"] = caller_address

    if not problem_description:
        extracted = _try_extract_field(messages, "problem_description")
        if extracted:
            problem_description = extracted
            updates["problem_description"] = problem_description

    # ------------------------------------------------------------------
    # 2. Check if collection is complete.
    # ------------------------------------------------------------------
    if all([caller_name, caller_phone, caller_address, problem_description]):
        updates["collection_complete"] = True
        updates["current_node"] = "booking"
        # Add a bridging message so the agent transitions smoothly
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

    # Match by slot number ([1], [2], [3]) or by label keywords
    for i, slot in enumerate(available_slots):
        if str(i + 1) in last_user:
            chosen_slot = slot
            break
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

    # Send SMS confirmation (never raises)
    sms_service.send_booking_confirmation(
        booking_details={
            "caller_name": caller_name,
            "caller_phone": caller_phone,
            "appointment_label": chosen_slot["label"],
            "business_name": business_name,
        },
        client_config=client_config,
    )

    # Persist booking to DB (best effort — do not crash the response)
    try:
        from backend.db.client import get_supabase
        supabase = get_supabase()
        supabase.table("bookings").insert({
            "client_id": client_id,
            "call_id": state.get("call_id"),
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
        # Mark call as booked
        supabase.table("call_logs").update({"was_booked": True}).eq(
            "call_id", state.get("call_id")
        ).execute()
    except Exception as exc:
        logger.error("Failed to persist booking to DB", client_id=client_id, error=str(exc))

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
    """Determine the next node after qualify based on current state."""
    if state.get("is_emergency"):
        return "emergency"
    if not state.get("collection_complete"):
        return "collect_info"
    if not state.get("booking_complete"):
        return "booking"
    return "end"
