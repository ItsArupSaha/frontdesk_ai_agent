from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import hmac
import hashlib
from backend.config import settings
from backend.utils.logging import get_logger
from backend.agents.graph import compiled_graph
from langchain_core.messages import HumanMessage, AIMessage
from backend.db.client import get_supabase
import asyncio

logger = get_logger(__name__)
router = APIRouter()

class PhoneNumber(BaseModel):
    number: str

class Call(BaseModel):
    id: str
    phoneNumber: Optional[PhoneNumber] = None

class Message(BaseModel):
    role: str
    content: str
    
class VapiMessageContent(BaseModel):
    type: str # assistant-request, status-update
    call: Optional[Call] = None
    conversation: Optional[List[Message]] = None
    status: Optional[str] = None

class VapiWebhookPayload(BaseModel):
    message: VapiMessageContent

def verify_vapi_secret(request: Request) -> bool:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return False
    expected = f"Bearer {settings.vapi_webhook_secret}"
    return hmac.compare_digest(auth_header.encode("utf-8"), expected.encode("utf-8"))

@router.post("/vapi")
async def vapi_webhook(request: Request, payload: VapiWebhookPayload):
    if not verify_vapi_secret(request):
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        msg_type = payload.message.type
        
        if msg_type == "status-update" and payload.message.status == "ended":
            # finalize call log logic would go here
            return {"status": "ok"}
            
        if msg_type == "assistant-request":
            call_id = payload.message.call.id if payload.message.call else "unknown"
            phone_num = payload.message.call.phoneNumber.number if payload.message.call and payload.message.call.phoneNumber else None
            
            supabase = get_supabase()
            
            # 1. Fetch Client Config
            client_config = None
            try:
                # We seed 'Test Plumbing Co' in 001_initial.sql for testing
                client_res = supabase.table("clients").select("*").eq("business_name", "Test Plumbing Co").limit(1).execute()
                if client_res.data:
                    row = client_res.data[0]
                    client_config = {
                        "id": str(row["id"]),
                        "business_name": row["business_name"],
                        "emergency_phone_number": row["emergency_phone_number"],
                        "working_hours": row["working_hours"],
                        "services_offered": row["services_offered"],
                        "service_area_description": row["service_area_description"],
                        "is_active": row["is_active"]
                    }
            except Exception as e:
                logger.warning(f"DB client lookup failed: {e}")

            if not client_config:
                client_config = {
                    "id": "123",
                    "business_name": "Test Plumbing Co",
                    "emergency_phone_number": "+15550000000",
                    "working_hours": {},
                    "services_offered": ["plumbing"],
                    "service_area_description": "New York",
                    "is_active": True
                }

            # 2. Fetch Conversation State
            state_data = {
                "current_node": "greeting",
                "is_emergency": False
            }
            try:
                state_res = supabase.table("conversation_state").select("*").eq("call_id", call_id).limit(1).execute()
                if state_res.data:
                    row = state_res.data[0]
                    state_data["current_node"] = row.get("current_node", "greeting")
                    state_data["is_emergency"] = row.get("is_emergency", False)
            except Exception as e:
                logger.warning(f"State lookup failed: {e}")
            
            messages = []
            if payload.message.conversation:
                for m in payload.message.conversation:
                    if m.role == "user":
                        messages.append(HumanMessage(content=m.content))
                    elif m.role == "assistant":
                        messages.append(AIMessage(content=m.content))
            
            if not messages:
                messages.append(HumanMessage(content="Hello"))

            state = {
                "messages": messages,
                "client_id": client_config["id"],
                "call_id": call_id,
                "current_node": state_data["current_node"],
                "caller_name": None,
                "caller_phone": phone_num,
                "problem_description": None,
                "is_emergency": state_data["is_emergency"],
                "service_area_confirmed": False,
                "client_config": client_config
            }
            
            try:
                result_state = await asyncio.wait_for(compiled_graph.ainvoke(state), timeout=4.0)
            except asyncio.TimeoutError:
                logger.error("Graph execution timed out")
                raise HTTPException(status_code=504, detail="Graph timeout")
            
            # 3. Save Updated Conversation State
            updated_state_data = {
                "call_id": call_id,
                "client_id": client_config["id"],
                "current_node": result_state.get("current_node", state_data["current_node"]),
                "is_emergency": result_state.get("is_emergency", False),
                "messages": [{"role": "assistant" if isinstance(m, AIMessage) else "user", "content": str(m.content)} for m in result_state["messages"]]
            }
            try:
                supabase.table("conversation_state").upsert(updated_state_data).execute()
            except Exception as e:
                logger.error(f"Failed to save state: {e}")
            
            final_message = result_state["messages"][-1]
            
            if isinstance(final_message, AIMessage) and final_message.tool_calls:
                for tc in final_message.tool_calls:
                    if tc["name"] == "escalate_call":
                        return {
                            "response": {
                                "action": "transfer-call",
                                "phoneNumber": client_config["emergency_phone_number"],
                                "message": "Connecting you to our emergency technician now."
                            }
                        }
            
            return {
                "response": {
                    "message": final_message.content if isinstance(final_message, AIMessage) else str(final_message)
                }
            }
            
        return {"status": "ignored"}
    except asyncio.TimeoutError:
        logger.error("Webhook timeout", exc_info=True)
        return {
            "response": {
                "action": "transfer-call",
                "phoneNumber": "+15550000000", 
                "message": "I'm having a technical issue. Let me connect you with someone directly."
            }
        }
    except Exception as e:
        logger.error("Webhook error", exc_info=True)
        return {
            "response": {
                "action": "transfer-call",
                "phoneNumber": "+15550000000", # default emergency
                "message": "I'm having a technical issue. Let me connect you with someone directly."
            }
        }
