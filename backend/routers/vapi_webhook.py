import asyncio
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import BaseModel, Field, ValidationError
from typing import Optional, List

from backend.config import settings
from backend.utils.logging import get_logger
from backend.utils.limiter import limiter
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
    # 10 000-char limit per message turn: prevents runaway LLM token spend and
    # server abuse from oversized payloads. Vapi transcripts are never this long
    # in practice (phone calls max out at ~200 words/minute ≈ ~1 000 chars/min).
    content: str = Field("", max_length=10_000)


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
@limiter.limit("60/minute")
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

            # --- Generate and persist call summary + transcript ---
            summary_client_id: str = ""
            call_outcome_from_state: str = ""
            conv_res = None
            try:
                conv_res = (
                    supabase.table("conversation_state")
                    .select("messages, client_id, booking_complete")
                    .eq("call_id", call_id)
                    .limit(1)
                    .execute()
                )
                if conv_res.data:
                    conv_row = conv_res.data[0]
                    raw_messages: list[dict] = conv_row.get("messages") or []
                    summary_client_id = str(conv_row.get("client_id", ""))

                    # Extract sentinel values from messages list
                    visible_messages: list[dict] = []
                    for msg in raw_messages:
                        role = msg.get("role", "")
                        if role == "__call_outcome__":
                            call_outcome_from_state = msg.get("content", "")
                        elif role not in ("__slots__", "__client_config__"):
                            visible_messages.append(msg)

                    # Fetch client_config for business name
                    summary_client_config: dict = {}
                    if summary_client_id:
                        cfg_res = (
                            supabase.table("clients")
                            .select("business_name, missed_call_threshold_seconds")
                            .eq("id", summary_client_id)
                            .limit(1)
                            .execute()
                        )
                        if cfg_res.data:
                            summary_client_config = cfg_res.data[0]

                    from backend.utils.summarizer import generate_call_summary
                    summary = await generate_call_summary(raw_messages, summary_client_config)

                    # Store summary + transcript (visible messages only, sentinel-free).
                    transcript_json = json.dumps(visible_messages)
                    update_payload = {
                        "summary": summary,
                        "transcript": transcript_json,
                        "status": "ended",
                        "duration_seconds": duration_seconds,
                    }
                    update_res = supabase.table("call_logs").update(
                        update_payload
                    ).eq("call_id", call_id).execute()

                    if not update_res.data:
                        supabase.table("call_logs").insert({
                            "call_id": call_id,
                            "client_id": summary_client_id or None,
                            "summary": summary,
                            "transcript": transcript_json,
                            "status": "ended",
                            "duration_seconds": duration_seconds,
                        }).execute()
                        logger.info("Call summary inserted (new row)", call_id=call_id)
                    else:
                        logger.info("Call summary + transcript stored", call_id=call_id)
            except Exception as exc:
                logger.error("Failed to generate/store call summary", call_id=call_id, error=str(exc))

            # --- Missed-call recovery SMS ---
            # Use booking_complete + call_outcome from conversation_state (set during the
            # call) rather than call_logs.was_booked (race condition avoided).
            # Skip SMS entirely for callers who were told they're out-of-area — sending
            # "we missed you" to someone we just rejected is unprofessional.
            was_booked_from_state: bool = False
            client_id_for_sms: str = summary_client_id or ""
            missed_call_threshold: int = int(
                (summary_client_config.get("missed_call_threshold_seconds") if summary_client_config else None) or 30
            )
            if conv_res and conv_res.data:
                was_booked_from_state = conv_res.data[0].get("booking_complete", False)

            skip_recovery = was_booked_from_state or call_outcome_from_state in ("out_of_area", "booked")

            if phone_num and duration_seconds > missed_call_threshold and not skip_recovery:
                try:
                    # Resolve business name and calling number from client record.
                    business_name = "our team"
                    vapi_calling_number: str | None = None
                    lookup_filter = (
                        supabase.table("clients")
                        .select("id, business_name, vapi_phone_number")
                        .eq("id", client_id_for_sms)
                        .limit(1)
                    ) if client_id_for_sms else (
                        supabase.table("clients")
                        .select("id, business_name, vapi_phone_number")
                        .eq("is_active", True)
                        .limit(1)
                    )
                    client_res = lookup_filter.execute()
                    if client_res.data:
                        business_name = client_res.data[0].get("business_name", "our team")
                        vapi_calling_number = client_res.data[0].get("vapi_phone_number")
                        if not client_id_for_sms:
                            client_id_for_sms = str(client_res.data[0].get("id", ""))

                    # Deduplication: send at most 1 recovery SMS per phone number per 24 hours.
                    # Prevents spam if caller dials multiple short calls in the same day.
                    already_sent = False
                    if client_id_for_sms and phone_num:
                        cutoff_24h = (
                            datetime.now(timezone.utc) - timedelta(hours=24)
                        ).isoformat()
                        try:
                            dedup_res = (
                                supabase.table("reminders_queue")
                                .select("id")
                                .eq("client_id", client_id_for_sms)
                                .eq("type", "missed_call_recovery")
                                .eq("to_number", phone_num)
                                .gte("created_at", cutoff_24h)
                                .limit(1)
                                .execute()
                            )
                            already_sent = bool(dedup_res.data)
                        except Exception:
                            pass  # Dedup check is best-effort; if it fails, send anyway

                    if already_sent:
                        logger.info(
                            "Missed-call recovery skipped — already sent within 24h",
                            call_id=call_id,
                            phone=phone_num,
                        )
                    elif client_id_for_sms:
                        # Build professional message with business name and calling number.
                        if vapi_calling_number:
                            formatted_num = vapi_calling_number
                        else:
                            formatted_num = None

                        if formatted_num:
                            recovery_msg = (
                                f"Hi, we're sorry for any inconvenience during your recent call with "
                                f"{business_name}. Please call us back at {formatted_num} "
                                f"and we'll be happy to assist you."
                            )
                        else:
                            recovery_msg = (
                                f"Hi, we're sorry for any inconvenience during your recent call with "
                                f"{business_name}. Please give us a call back and we'll be happy to assist you."
                            )

                        scheduled_for = (
                            datetime.now(timezone.utc) + timedelta(minutes=2)
                        ).isoformat()
                        try:
                            supabase.table("reminders_queue").insert({
                                "client_id": client_id_for_sms,
                                "type": "missed_call_recovery",
                                "to_number": phone_num,
                                "scheduled_for": scheduled_for,
                                "message_body": recovery_msg,
                            }).execute()
                            logger.info(
                                "Missed-call recovery queued",
                                call_id=call_id,
                                scheduled_for=scheduled_for,
                            )
                        except Exception as exc:
                            logger.error(
                                "Failed to queue missed-call recovery",
                                call_id=call_id,
                                error=str(exc),
                            )
                            # Fallback: send directly so caller is never left without follow-up
                            from backend.services import sms_service
                            sms_service.send_missed_call_recovery(
                                caller_number=phone_num,
                                business_name=business_name,
                                client_id=client_id_for_sms,
                                calling_number=vapi_calling_number,
                            )
                    else:
                        # No client_id — send directly (queue FK would fail)
                        from backend.services import sms_service
                        sms_service.send_missed_call_recovery(
                            caller_number=phone_num,
                            business_name=business_name,
                            client_id=client_id_for_sms,
                            calling_number=vapi_calling_number,
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
        #
        # CONFIG CACHING: client_config is loaded from DB on the FIRST turn of a
        # call (when conversation_state has no cached config) and stored in the
        # conversation_state as a __client_config__ sentinel message entry.
        # Subsequent turns read config from this cache — never re-read from DB
        # mid-call. This ensures settings changes take effect on the NEXT call,
        # not mid-conversation, preventing inconsistent conversation state.

        def _db_client_config() -> dict | None:
            """Load client config from DB by Twilio phone number or fallback to first active client."""
            try:
                # Match by Twilio phone number if available — multi-tenant routing.
                # Use a fresh query builder for each call — older supabase-py versions
                # (≤2.15) mutate the builder in place, so reusing `query` would stack
                # filters and silently return empty on the fallback path.
                if phone_num:
                    res = supabase.table("clients").select("*").eq("twilio_phone_number", phone_num).limit(1).execute()
                    if res.data:
                        return _row_to_config(res.data[0])
                # Fallback: oldest active client by created_at (dev/single-tenant mode).
                # ORDER BY created_at ensures deterministic result — without it Postgres
                # returns an arbitrary row when multiple active clients exist.
                res = supabase.table("clients").select("*").eq("is_active", True).order("created_at").limit(1).execute()
                if res.data:
                    return _row_to_config(res.data[0])
            except Exception as exc:
                logger.warning("DB client lookup failed", error=str(exc))
            return None

        def _row_to_config(row: dict) -> dict:
            """Map a clients DB row to the client_config dict used by the agent."""
            return {
                "id": str(row["id"]),
                "business_name": row["business_name"],
                "bot_name": row.get("bot_name") or "Alex",
                "emergency_phone_number": row["emergency_phone_number"],
                "main_phone_number": row.get("main_phone_number") or "",
                "is_ai_enabled": row.get("is_ai_enabled", True),
                "timezone": row.get("timezone") or "America/New_York",
                "missed_call_threshold_seconds": int(row.get("missed_call_threshold_seconds") or 30),
                "appointment_duration_minutes": int(row.get("appointment_duration_minutes") or 60),
                "working_hours": row.get("working_hours") or {},
                "services_offered": row.get("services_offered") or [],
                "service_area_description": row.get("service_area_description") or "",
                "google_review_link": row.get("google_review_link") or "",
                "is_active": row.get("is_active", True),
                "fsm_type": row.get("fsm_type"),
                "jobber_api_key": row.get("jobber_api_key") or "",
                "housecall_pro_api_key": row.get("housecall_pro_api_key") or "",
            }

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
                    import json as _json
                    # Recover persisted available_slots and cached client_config
                    # from sentinel message entries. Sentinel roles:
                    #   __slots__        → available time slots (JSON array)
                    #   __client_config__ → client config cached at call start (JSON object)
                    available_slots: list = []
                    cached_config: dict | None = None
                    call_outcome: str | None = None
                    for msg in row.get("messages") or []:
                        role = msg.get("role")
                        if role == "__slots__":
                            try:
                                available_slots = _json.loads(msg.get("content", "[]"))
                            except Exception:
                                available_slots = []
                        elif role == "__client_config__":
                            try:
                                cached_config = _json.loads(msg.get("content", "{}"))
                            except Exception:
                                cached_config = None
                        elif role == "__call_outcome__":
                            call_outcome = msg.get("content")
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
                        "cached_client_config": cached_config,
                        "call_outcome": call_outcome,
                    }
            except Exception as exc:
                logger.warning("State lookup failed", error=str(exc))
            return default

        client_config_from_db, state_data = await asyncio.gather(
            loop.run_in_executor(None, _db_client_config),
            loop.run_in_executor(None, _db_conversation_state),
        )

        # Config intentionally cached at call start — settings changes take effect
        # on the NEXT call, not mid-conversation. Read from conversation_state cache
        # on subsequent turns; only hit the DB on the first turn of each call.
        cached_config = state_data.get("cached_client_config")
        client_config: dict = cached_config or client_config_from_db or {
            "id": "unknown",
            "business_name": "Our Business",
            "emergency_phone_number": "+15550000000",
            "working_hours": {},
            "services_offered": [],
            "service_area_description": "",
            "is_active": True,
        }

        emergency_number = client_config.get("emergency_phone_number", "+15550000000")

        # AI toggle: if client has disabled AI forwarding, transfer to their main number.
        if not client_config.get("is_ai_enabled", True):
            main_phone = client_config.get("main_phone_number") or emergency_number
            logger.info("AI disabled for client — forwarding call", client_id=client_config["id"])
            return {
                "response": {
                    "action": "transfer-call",
                    "phoneNumber": main_phone,
                    "message": "Please hold while I connect you.",
                }
            }

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
            "call_outcome": state_data.get("call_outcome"),
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
                # Sentinel: persist available_slots across webhook turns
                [{"role": "__slots__", "content": __import__("json").dumps(result_state.get("available_slots", []))}]
                if result_state.get("available_slots")
                else []
            ) + [
                # Sentinel: cache client_config at call start so settings changes
                # mid-call don't affect the current conversation.
                {"role": "__client_config__", "content": __import__("json").dumps(client_config)}
            ] + (
                # Sentinel: persist call_outcome so status-update/ended handler can
                # skip recovery SMS for out_of_area and already-booked callers.
                [{"role": "__call_outcome__", "content": result_state["call_outcome"]}]
                if result_state.get("call_outcome")
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
        # IMPORTANT: was_booked is intentionally NOT set here. It is set by the background
        # _sms_and_db() task in booking_node ONLY after the booking row is confirmed in the DB.
        # Setting it here from graph state (before the insert completes) causes was_booked=True
        # in call_logs even when the bookings insert fails in the background task.
        is_emergency_result = result_state.get("is_emergency", False)
        if is_emergency_result:
            try:
                await loop.run_in_executor(
                    None,
                    lambda: supabase.table("call_logs")
                    .update({"was_emergency": True})
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
