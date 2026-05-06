"""qualify_node — qualifies caller intent and detects emergencies."""
from langchain_core.messages import SystemMessage

from backend.agents.message_utils import last_user_message as _last_user_message
from backend.agents.state import AgentState
from backend.utils.emergency import detect_emergency


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

    cfg = state["client_config"]
    business_name = cfg.get("business_name", "our business")
    bot_name = cfg.get("bot_name", "Alex")

    services = ", ".join(cfg.get("services_offered") or []) or "general home services"
    area = cfg.get("service_area_description") or "our local service area"
    hours = cfg.get("working_hours") or "during business hours"

    system_prompt = (
        f"You are {bot_name}, a friendly AI receptionist for {business_name}. "
        "Speak naturally and warmly — like a real person, not a robot.\n\n"
        f"BUSINESS INFO (use this to answer questions directly — never say you don't know):\n"
        f"- Services: {services}\n"
        f"- Service area: {area}\n"
        f"- Hours: {hours}\n\n"
        "RULES:\n"
        "1. If caller asks about services, area, or hours — answer directly using the info above.\n"
        "2. If caller wants to book — get their name to start the booking process.\n"
        "3. Only ask ONE question per response.\n"
        "4. Do NOT ask for phone number, address, or availability — the booking flow handles that.\n"
        "5. Keep responses under 3 sentences."
    )

    import backend.agents.nodes as _nodes_pkg
    llm = _nodes_pkg._get_llm(state["client_config"])
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = await llm.ainvoke(messages)

    # Determine where the next webhook turn should start.
    if state.get("collection_complete"):
        next_node = "booking"
    else:
        next_node = "collect_info"

    return {"messages": [response], "current_node": next_node}
