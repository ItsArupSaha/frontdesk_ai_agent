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

    business_name = state["client_config"].get("business_name", "our business")
    bot_name = state["client_config"].get("bot_name", "Alex")
    system_prompt = (
        f"You are {bot_name}, a friendly AI receptionist for {business_name}. "
        "Speak naturally and warmly — like a real person, not a robot.\n\n"
        "RULES:\n"
        "1. If the caller is asking about services, coverage area, hours, or anything "
        "about the business — call the `get_business_info` tool FIRST, then answer naturally "
        "using that information. Never say 'I don't have access to that information.'\n"
        "2. If the caller wants to book, get their name to start the booking process.\n"
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
