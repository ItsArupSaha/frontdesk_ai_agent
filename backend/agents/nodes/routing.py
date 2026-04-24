"""routing_node — graph routing function after qualify."""
from backend.agents.state import AgentState


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
