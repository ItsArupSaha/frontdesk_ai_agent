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
        # Call ended — generate summary + send missed-call recovery SMS
        # ------------------------------------------------------------------
        if msg_type == "status-update" and payload.message.status == "ended":
            call_id = payload.message.call.id if payload.message.call else "unknown"
            phone_num = (
                payload.message.call.phoneNumber.number
                if payload.message.call and payload.message.call.phoneNumber
                else None
            )
            duration_seconds = payload.message.durationSeconds or 0

            supabase = get_supabase()

            # --- Generate and persist call summary ---
            try:
                conv_res = (
                    supabase.table("conversation_state")
                    .select("messages, client_id")
                    .eq("call_id", call_id)
                    .limit(1)
                    .execute()
                )
                if conv_res.data:
                    conv_row = conv_res.data[0]
                    raw_messages: list[dict] = conv_row.get("messages") or []
                    summary_client_id: str = str(conv_row.get("client_id", ""))

                    # Fetch client_config for business name
                    summary_client_config: dict = {}
                    if summary_client_id:
                        cfg_res = (
                            supabase.table("clients")
                            .select("business_name")
                            .eq("id", summary_client_id)
                            .limit(1)
                            .execute()
                        )
                        if cfg_res.data:
                            summary_client_config = cfg_res.data[0]

                    from backend.utils.summarizer import generate_call_summary
                    summary = await generate_call_summary(raw_messages, summary_client_config)

                    # Update existing call_logs row if it exists.
                    # If none exists (call ended before agent responded), insert one
                    # so the summary is never silently dropped.
                    update_res = supabase.table("call_logs").update(
                        {"summary": summary}
                    ).eq("call_id", call_id).execute()

                    if not update_res.data:
                        # No call_logs row yet — insert a minimal one with the summary
                        supabase.table("call_logs").insert({
                            "call_id": call_id,
                            "client_id": summary_client_id or None,
                            "summary": summary,
                            "status": "ended",
                        }).execute()
                        logger.info("Call summary inserted (new row)", call_id=call_id)
                    else:
                        logger.info("Call summary stored", call_id=call_id)
            except Exception as exc:
                logger.error("Failed to generate/store call summary", call_id=call_id, error=str(exc))

            # --- Missed-call recovery SMS ---
            if phone_num and duration_seconds > 15:
                try:
                    # Check if this call resulted in a booking.
                    # A missing call_log row (caller never reached the assistant)
                    # is treated as "not booked" — always send recovery SMS.
                    log_res = (
                        supabase.table("call_logs")
                        .select("was_booked, client_id")
                        .eq("call_id", call_id)
                        .limit(1)
                        .execute()
                    )
                    was_booked: bool = False
                    client_id_for_sms: str = ""
                    if log_res.data:
                        row = log_res.data[0]
                        was_booked = row.get("was_booked", False)
                        client_id_for_sms = str(row.get("client_id", ""))

                    if not was_booked:
                        # Resolve business name: from the matched client record, or
                        # fall back to the first active client (single-tenant fallback).
                        business_name = "our team"
                        lookup_filter = (
                            supabase.table("clients")
                            .select("id, business_name")
                            .eq("id", client_id_for_sms)
                            .limit(1)
                        ) if client_id_for_sms else (
                            supabase.table("clients")
                            .select("id, business_name")
                            .eq("is_active", True)
                            .limit(1)
                        )
                        client_res = lookup_filter.execute()
                        if client_res.data:
                            business_name = client_res.data[0].get("business_name", "our team")
                            if not client_id_for_sms:
                                client_id_for_sms = str(client_res.data[0].get("id", ""))

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
        loop = asyncio.get_event_loop()

        # 1 & 2. Fetch client config AND conversation state in parallel.
        # supabase-py is a synchronous client — wrapping each call in
        # run_in_executor prevents it from blocking the async event loop,
        # and gather() runs both DB round-trips concurrently.
        def _db_client_config() -> dict | None:
            try:
                res = (
                    supabase.table("clients")
                    .select("*")
                    .eq("business_name", "Test Plumbing Co")
                    .limit(1)
                    .execute()
                )
                if res.data:
                    row = res.data[0]
                    return {
                        "id": str(row["id"]),
                        "business_name": row["business_name"],
                        "emergency_phone_number": row["emergency_phone_number"],
                        "working_hours": row["working_hours"],
                        "services_offered": row["services_offered"],
                        "service_area_description": row["service_area_description"],
                        "is_active": row["is_active"],
                        # FSM sync config (optional per client)
                        "fsm_type": row.get("fsm_type"),
                        "jobber_api_key": row.get("jobber_api_key") or "",
                        "housecall_pro_api_key": row.get("housecall_pro_api_key") or "",
                    }
            except Exception as exc:
                logger.warning("DB client lookup failed", error=str(exc))
            return None

        def _db_conversation_state() -> dict:
            default: dict = {"current_node": "greeting", "is_emergency": False}
            try:
                res = (
                    supabase.table("conversation_state")
                    .select("*")
                    .eq("call_id", call_id)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    row = res.data[0]
                    # Recover persisted available_slots from sentinel message entry
                    available_slots: list = []
                    for msg in row.get("messages") or []:
                        if msg.get("role") == "__slots__":
                            import json as _json
                            try:
                                available_slots = _json.loads(msg.get("content", "[]"))
                            except Exception:
                                available_slots = []
                            break
                    return {
                        "current_node": row.get("current_node", "greeting"),
                        "is_emergency": row.get("is_emergency", False),
                        "caller_name": row.get("caller_name"),
                        "caller_phone": row.get("caller_phone"),
                        "caller_address": row.get("caller_address"),
                        "problem_description": row.get("problem_description"),
                        "collection_complete": row.get("collection_complete", False),
                        "booking_complete": row.get("booking_complete", False),
                        "available_slots": available_slots,
                    }
            except Exception as exc:
                logger.warning("State lookup failed", error=str(exc))
            return default

        client_config_raw, state_data = await asyncio.gather(
            loop.run_in_executor(None, _db_client_config),
            loop.run_in_executor(None, _db_conversation_state),
        )

        client_config: dict = client_config_raw or {
            "id": "123",
            "business_name": "Test Plumbing Co",
            "emergency_phone_number": "+15550000000",
            "working_hours": {},
            "services_offered": ["plumbing"],
            "service_area_description": "New York",
            "is_active": True,
        }

        emergency_number = client_config.get("emergency_phone_number", "+15550000000")

        # 3. Ensure a call_logs row exists for this call (upsert — safe on every turn).
        try:
            await loop.run_in_executor(
                None,
                lambda: supabase.table("call_logs")
                .upsert(
                    {
                        "call_id": call_id,
                        "client_id": client_config["id"],
                        "caller_number": phone_num,
                        "was_emergency": state_data.get("is_emergency", False),
                        "was_booked": state_data.get("booking_complete", False),
                        "status": "in_progress",
                    },
                    on_conflict="call_id",
                    ignore_duplicates=True,
                )
                .execute(),
            )
        except Exception as exc:
            logger.warning("call_log upsert failed", call_id=call_id, error=str(exc))

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
            "available_slots": state_data.get("available_slots", []),
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
            ] + (
                # Sentinel entry to persist available_slots across webhook turns
                [{"role": "__slots__", "content": __import__("json").dumps(result_state.get("available_slots", []))}]
                if result_state.get("available_slots")
                else []
            ),
        }
        try:
            await loop.run_in_executor(
                None,
                lambda: supabase.table("conversation_state")
                .upsert(updated_state_data)
                .execute(),
            )
        except Exception as exc:
            logger.error("Failed to save conversation state", error=str(exc))

        # 5. Update call_log flags based on graph outcome (best-effort, non-blocking).
        is_emergency_result = result_state.get("is_emergency", False)
        is_booked_result = result_state.get("booking_complete", False)
        if is_emergency_result or is_booked_result:
            try:
                update_payload: dict = {}
                if is_emergency_result:
                    update_payload["was_emergency"] = True
                if is_booked_result:
                    update_payload["was_booked"] = True
                await loop.run_in_executor(
                    None,
                    lambda: supabase.table("call_logs")
                    .update(update_payload)
                    .eq("call_id", call_id)
                    .execute(),
                )
            except Exception as exc:
                logger.error("call_log flag update failed", call_id=call_id, error=str(exc))

        # 6. Translate graph output to Vapi response
        final_message = result_state["messages"][-1]

        # Emergency: always transfer — do not rely solely on the LLM calling the tool.
        if result_state.get("is_emergency"):
            spoken = (
                final_message.content
                if isinstance(final_message, AIMessage) and final_message.content
                else "Connecting you to our emergency technician now."
            )
            return {
                "response": {
                    "action": "transfer-call",
                    "phoneNumber": emergency_number,
                    "message": spoken,
                }
            }

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
