from pydantic import BaseModel
from datetime import datetime

class ClientConfig(BaseModel):
    id: str
    business_name: str
    emergency_phone_number: str
    working_hours: dict  # {"mon": "8am-6pm", ...}
    services_offered: list[str]
    service_area_description: str
    is_active: bool

class CallLog(BaseModel):
    id: str | None = None
    client_id: str
    call_id: str  # Vapi call ID
    caller_number: str
    started_at: datetime
    ended_at: datetime | None = None
    was_emergency: bool = False
    was_booked: bool = False
    summary: str | None = None
    transcript: list[dict] = []
    status: str = "in_progress"  # in_progress | completed | failed

class ConversationState(BaseModel):
    client_id: str
    call_id: str
    current_node: str = "GREETING"
    caller_name: str | None = None
    caller_phone: str | None = None
    problem_description: str | None = None
    is_emergency: bool = False
    messages: list[dict] = []
