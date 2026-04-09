from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    client_id: str
    call_id: str
    current_node: str
    caller_name: str | None
    caller_phone: str | None
    problem_description: str | None
    is_emergency: bool
    service_area_confirmed: bool
    client_config: dict
