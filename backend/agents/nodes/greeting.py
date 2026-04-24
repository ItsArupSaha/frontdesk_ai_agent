"""greeting_node — handles the first turn of a call."""
from langchain_core.messages import AIMessage

from backend.agents.message_utils import last_user_message as _last_user_message
from backend.agents.state import AgentState
from backend.utils.emergency import detect_emergency


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
    bot_name = state["client_config"].get("bot_name", "Alex")
    if first_user_msg:
        greeting_text = (
            f"Thank you for calling {business_name}! I'm {bot_name}, your virtual assistant. "
            f"I heard you mention '{first_user_msg[:80]}' — let me help you with that. "
            "Could you give me a bit more detail?"
        )
    else:
        greeting_text = (
            f"Thank you for calling {business_name}! I'm {bot_name}, your virtual assistant. "
            "How can I help you today?"
        )
    return {
        "messages": [AIMessage(content=greeting_text)],
        "current_node": "qualify",
    }
