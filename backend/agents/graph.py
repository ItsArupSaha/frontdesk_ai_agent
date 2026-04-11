"""
LangGraph state machine definition for the AI front-desk agent.

Flow (per webhook turn):
  GREETING → QUALIFY → {EMERGENCY | COLLECT_INFO* | FAQ}
  COLLECT_INFO loops until all 4 fields are gathered, then routes to BOOKING.
  BOOKING loops until a slot is confirmed.

*Each loop iteration = one Vapi webhook round-trip.
 The current_node field persisted in DB controls which node starts next turn.
"""
from langgraph.graph import END, StateGraph

from backend.agents.nodes import (
    booking_node,
    collect_info_node,
    emergency_node,
    greeting_node,
    qualify_node,
    routing_node,
)
from backend.agents.state import AgentState

workflow = StateGraph(AgentState)

# Register nodes
workflow.add_node("greeting", greeting_node)
workflow.add_node("qualify", qualify_node)
workflow.add_node("emergency", emergency_node)
workflow.add_node("collect_info", collect_info_node)
workflow.add_node("booking", booking_node)
workflow.add_node("faq", lambda state: {"messages": []})  # Placeholder for Phase 3

# Entry point: select node based on persisted current_node
workflow.set_conditional_entry_point(
    lambda state: state.get("current_node", "greeting"),
    {
        "greeting": "greeting",
        "qualify": "qualify",
        "emergency": "emergency",
        "collect_info": "collect_info",
        "booking": "booking",
        "faq": "faq",
    },
)

# After greeting → emergency if emergency was detected, otherwise END.
# greeting_node sets current_node="qualify" for normal turns so the next
# webhook resumes at qualify.  When is_emergency=True the graph routes to
# emergency_node in the same turn without an extra round-trip.
workflow.add_conditional_edges(
    "greeting",
    lambda state: "emergency" if state.get("is_emergency") else END,
    {"emergency": "emergency", END: END},
)

# After qualify → only emergency routes to emergency node in the same turn.
# For every other route the graph ends; qualify_node sets current_node so the
# next webhook turn resumes at the correct node.
workflow.add_conditional_edges(
    "qualify",
    routing_node,
    {
        "emergency": "emergency",
        "collect_info": END,
        "booking": END,
        "faq": END,
        "end": END,
    },
)

# After collect_info → check if complete; if yes route to booking in same turn.
# booking_node does NOT call the LLM (it uses the calendar API + builds a static
# AIMessage), so this chain is: static-reply + calendar call — no extra LLM round-trip.
workflow.add_conditional_edges(
    "collect_info",
    lambda state: "booking" if state.get("collection_complete") else END,
    {"booking": "booking", END: END},
)

# Terminals
workflow.add_edge("booking", END)
workflow.add_edge("emergency", END)
workflow.add_edge("faq", END)

compiled_graph = workflow.compile()
