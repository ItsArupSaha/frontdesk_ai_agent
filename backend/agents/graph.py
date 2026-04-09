from langgraph.graph import StateGraph, END
from backend.agents.state import AgentState
from backend.agents.nodes import greeting_node, qualify_node, emergency_node, routing_node

workflow = StateGraph(AgentState)

workflow.add_node("greeting", greeting_node)
workflow.add_node("qualify", qualify_node)
workflow.add_node("emergency", emergency_node)
workflow.add_node("faq", lambda state: {"messages": []}) # Placeholder

workflow.set_conditional_entry_point(
    lambda state: state.get("current_node", "greeting"),
    {
        "greeting": "greeting",
        "qualify": "qualify",
        "emergency": "emergency"
    }
)

workflow.add_edge("greeting", END)

workflow.add_conditional_edges(
    "qualify",
    routing_node,
    {
        "emergency": "emergency",
        "qualify": END,
        "faq": "faq"
    }
)

workflow.add_edge("emergency", END)
workflow.add_edge("faq", END)

compiled_graph = workflow.compile()
