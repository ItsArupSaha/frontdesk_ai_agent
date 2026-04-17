from typing import Annotated
from langgraph.graph.message import add_messages


class AgentState(dict):
    """Conversation state passed through the LangGraph state machine.

    Using a plain dict subclass (rather than TypedDict) so that nodes can
    read missing fields safely with .get() without requiring all keys to be
    present in every partial update.
    """
    messages: Annotated[list, add_messages]
    client_id: str
    call_id: str
    current_node: str
    caller_name: str | None
    caller_phone: str | None
    caller_address: str | None
    problem_description: str | None
    is_emergency: bool
    service_area_confirmed: bool
    collection_complete: bool
    available_slots: list
    chosen_slot: dict | None
    booking_complete: bool
    call_outcome: str | None  # "out_of_area" | "booked" | "faq_resolved" | "abandoned"
    client_config: dict
