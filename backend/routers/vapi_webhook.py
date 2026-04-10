import asyncio
import hashlib
import hmac
import json

from fastapi import APIRouter, HTTPException, Request
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import BaseModel, ValidationError
from typing import Optional, List

from backend.config import settings
from backend.utils.logging import get_logger
from backend.agents.graph import compiled_graph
from backend.db.client import get_supabase

logger = get_logger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic models for incoming Vapi webhook payload
# ---------------------------------------------------------------------------

class PhoneNumber(BaseModel):
    number: str


class Call(BaseModel):
    id: str
    phoneNumber: Optional[PhoneNumber] = None


class Message(BaseModel):
    role: str
    content: str


class VapiMessageContent(BaseModel):
    type: str  # assistant-request | status-update
    call: Optional[Call] = None
    conversation: Optional[List[Message]] = None
    status: Optional[str] = None
    durationSeconds: Optional[float] = None


class VapiWebhookPayload(BaseModel):
    message: VapiMessageContent


# ---------------------------------------------------------------------------
# Signature validation — HMAC-SHA256 (primary) + Bearer token (fallback)
# ---------------------------------------------------------------------------

def verify_vapi_secret(request: Request, raw_body: bytes) -> bool:
    """Verify Vapi webhook authenticity.

    Checks the ``x-vapi-signature`` header using HMAC-SHA256 first.
    Falls back to an ``Authorization: Bearer <secret>`` check so that
    existing live Vapi integrations continue to work without change.

    Returns True if the request is authentic, False otherwise.
    """
    secret = settings.vapi_webhook_secret

    # Primary: HMAC-SHA256 via x-vapi-signature header
    sig_header = request.headers.get("x-vapi-signature")
    if sig_header:
        expected = hmac.new(
            secret.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(sig_header, expected)

    # Fallback: simple Bearer token (Vapi's current webhook auth method)
    auth_header = request.headers.get("Authorization")
    if auth_header:
        expected_bearer = f"Bearer {secret}"
        return hmac.compare_digest(
            auth_header.encode("utf-8"),
            expected_bearer.encode("utf-8"),
        )

    return False


# ---------------------------------------------------------------------------
# Webhook handler
# ---------------------------------------------------------------------------

@router.post("/vapi")
async def vapi_webhook(request: Request) -> dict:
    """Handle all inbound Vapi webhook events.

    Responds within 4 seconds to stay under Vapi's 5-second timeout.
    On any unhandled exception the handler returns a safe fallback response
    (200 + transfer-call) so the caller is never left in silence.
    """
    raw_body = await request.body()

    if not verify_vapi_secret(request, raw_body):
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        payload_dict = json.loads(raw_body)
        payload = VapiWebhookPayload(**payload_dict)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Pre-initialize for use in exception handlers before try block populates them
    call_id: str = "unknown"
    emergency_number: str = "+15550000000"

    try:
        msg_type = payload.message.type

        # ------------------------------------------------------------------
        # Call ended — send missed-call recovery SMS if caller didn't book
        # ------------------------------------------------------------------
        if msg_type == "status-update" and payload.message.status == "ended":
            call_id = payload.message.call.id if payload.message.call else "unknown"
            phone_num = (
                payload.message.call.phoneNumber.number
                if payload.message.call and payload.message.call.phoneNumber
                else None
            )
            duration_seconds = payload.message.durationSeconds or 0

            if phone_num and duration_seconds > 15:
                supabase = get_supabase()
                try:
                    # Check if this call resulted in a booking
                    log_res = (
                        supabase.table("call_logs")
                        .select("was_booked, client_id")
                        .eq("call_id", call_id)
                        .limit(1)
                        .execute()
                    )
                    if log_res.data:
                        row = log_res.data[0]
                        was_booked = row.get("was_booked", False)
                        client_id_for_sms = str(row.get("client_id", ""))
                        if not was_booked:
                            # Fetch business name
                            client_res = (
                                supabase.table("clients")
                                .select("business_name")
                                .eq("id", client_id_for_sms)
                                .limit(1)
                                .execute()
                            )
                            business_name = "our team"
                            if client_res.data:
                                business_name = client_res.data[0].get("business_name", "our team")

                            from backend.services import sms_service
                            sms_service.send_missed_call_recovery(
                                caller_number=phone_num,
                                business_name=business_name,
                                client_id=client_id_for_sms,
                            )
                except Exception as exc:
                    logger.error("Missed-call recovery failed", call_id=call_id, error=str(exc))

            return {"status": "ok"}

        if msg_type != "assistant-request":
            return {"status": "ignored"}

        call_id = payload.message.call.id if payload.message.call else "unknown"
        phone_num = (
            payload.message.call.phoneNumber.number
            if payload.message.call and payload.message.call.phoneNumber
            else None
        )

        supabase = get_supabase()

        # 1. Fetch client config from DB; fall back to test config on failure
        client_config: dict | None = None
        try:
            client_res = (
                supabase.table("clients")
                .select("*")
                .eq("business_name", "Test Plumbing Co")
                .limit(1)
                .execute()
            )
            if client_res.data:
                row = client_res.data[0]
                client_config = {
                    "id": str(row["id"]),
                    "business_name": row["business_name"],
                    "emergency_phone_number": row["emergency_phone_number"],
                    "working_hours": row["working_hours"],
                    "services_offered": row["services_offered"],
                    "service_area_description": row["service_area_description"],
                    "is_active": row["is_active"],
                }
        except Exception as exc:
            logger.warning("DB client lookup failed", error=str(exc))

        if not client_config:
            client_config = {
                "id": "123",
                "business_name": "Test Plumbing Co",
                "emergency_phone_number": "+15550000000",
                "working_hours": {},
                "services_offered": ["plumbing"],
                "service_area_description": "New York",
                "is_active": True,
            }

        emergency_number = client_config.get("emergency_phone_number", "+15550000000")

        # 2. Fetch or initialise conversation state from DB
        state_data: dict = {"current_node": "greeting", "is_emergency": False}
        try:
            state_res = (
                supabase.table("conversation_state")
                .select("*")
                .eq("call_id", call_id)
                .limit(1)
                .execute()
            )
            if state_res.data:
                row = state_res.data[0]
                state_data = {
                    "current_node": row.get("current_node", "greeting"),
                    "is_emergency": row.get("is_emergency", False),
                    "caller_name": row.get("caller_name"),
                    "caller_phone": row.get("caller_phone"),
                    "caller_address": row.get("caller_address"),
                    "problem_description": row.get("problem_description"),
                    "collection_complete": row.get("collection_complete", False),
                    "booking_complete": row.get("booking_complete", False),
                }
        except Exception as exc:
            logger.warning("State lookup failed", error=str(exc))

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
            "current_node": state_data.get("current_node", "greeting"),
            "caller_name": state_data.get("caller_name"),
            "caller_phone": state_data.get("caller_phone") or phone_num,
            "caller_address": state_data.get("caller_address"),
            "problem_description": state_data.get("problem_description"),
            "is_emergency": state_data.get("is_emergency", False),
            "service_area_confirmed": False,
            "collection_complete": state_data.get("collection_complete", False),
            "available_slots": [],
            "chosen_slot": None,
            "booking_complete": state_data.get("booking_complete", False),
            "client_config": client_config,
        }

        # 3. Run LangGraph — enforce 4-second timeout (Vapi times out at 5s)
        result_state = await asyncio.wait_for(
            compiled_graph.ainvoke(state), timeout=4.0
        )

        # 4. Persist updated conversation state
        updated_state_data = {
            "call_id": call_id,
            "client_id": client_config["id"],
            "current_node": result_state.get("current_node", state_data.get("current_node", "greeting")),
            "is_emergency": result_state.get("is_emergency", False),
            "caller_name": result_state.get("caller_name"),
            "caller_phone": result_state.get("caller_phone"),
            "caller_address": result_state.get("caller_address"),
            "problem_description": result_state.get("problem_description"),
            "collection_complete": result_state.get("collection_complete", False),
            "booking_complete": result_state.get("booking_complete", False),
            "messages": [
                {
                    "role": "assistant" if isinstance(m, AIMessage) else "user",
                    "content": str(m.content),
                }
                for m in result_state["messages"]
            ],
        }
        try:
            supabase.table("conversation_state").upsert(updated_state_data).execute()
        except Exception as exc:
            logger.error("Failed to save conversation state", error=str(exc))

        # 5. Translate graph output to Vapi response
        final_message = result_state["messages"][-1]

        if isinstance(final_message, AIMessage) and final_message.tool_calls:
            for tc in final_message.tool_calls:
                if tc["name"] == "escalate_call":
                    return {
                        "response": {
                            "action": "transfer-call",
                            "phoneNumber": emergency_number,
                            "message": "Connecting you to our emergency technician now.",
                        }
                    }

        return {
            "response": {
                "message": (
                    final_message.content
                    if isinstance(final_message, AIMessage)
                    else str(final_message)
                )
            }
        }

    except asyncio.TimeoutError:
        logger.error("Graph execution timed out", call_id=call_id)
        return {
            "response": {
                "action": "transfer-call",
                "phoneNumber": emergency_number,
                "message": "I'm having a technical issue. Let me connect you with someone directly.",
            }
        }
    except Exception:
        logger.error("Unhandled webhook error", exc_info=True)
        return {
            "response": {
                "action": "transfer-call",
                "phoneNumber": emergency_number,
                "message": "I'm having a technical issue. Let me connect you with someone directly.",
            }
        }
