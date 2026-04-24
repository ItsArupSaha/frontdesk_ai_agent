"""emergency_node — handles emergency escalation."""
from langchain_core.messages import SystemMessage

from backend.agents.state import AgentState


async def emergency_node(state: AgentState) -> dict:
    """Handle emergency situations by escalating the call immediately."""
    system_prompt = (
        "This is an emergency. Your ONLY job is to:\n"
        "1. Confirm you understand the emergency\n"
        "2. Tell the caller you are connecting them to a technician NOW\n"
        "3. Call the escalate_call tool immediately\n"
        "Do not ask more questions. Do not try to solve the problem. Act fast."
    )

    import backend.agents.nodes as _nodes_pkg
    llm = _nodes_pkg._get_llm(state["client_config"])
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = await llm.ainvoke(messages)

    return {"messages": [response]}
