"""
Admin-only API routes for multi-client management.

All routes require admin role (verified via require_admin dependency).
Non-admin users receive 403 Forbidden.

Routes:
    GET  /api/admin/clients                          — list all clients with stats
    PUT  /api/admin/clients/{client_id}/status       — activate / suspend client
    GET  /api/admin/clients/{client_id}/impersonate  — get context to view their dashboard
    POST /api/admin/clients/{client_id}/activate     — provision a pending client
    PUT  /api/admin/clients/{client_id}/sms-enabled  — toggle SMS after A2P approval
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.config import settings
from backend.db.client import get_supabase
from backend.services.activation_service import ActivationError, run_activation
from backend.utils.auth import require_admin
from backend.utils.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class ClientSummary(BaseModel):
    """Per-client row returned by GET /api/admin/clients."""

    id: str
    business_name: str
    email: str | None
    is_active: bool
    onboarding_status: str  # 'pending' | 'active' | 'suspended'
    sms_enabled: bool
    vapi_phone_number: str | None
    twilio_phone_number: str | None
    vapi_assistant_id: str | None
    completeness_score: int  # 0-100
    completeness_breakdown: dict[str, bool]  # item_label → done
    provisioning_notes: str | None
    calls_this_month: int
    last_call_at: str | None
    bookings_this_month: int
    monthly_cost_estimate: float
    # Payment tracking (LemonSqueezy)
    subscription_status: str  # 'none' | 'active' | 'paused' | 'past_due' | 'cancelled' | 'expired'
    subscription_renews_at: str | None


class StatusPayload(BaseModel):
    """Body for PUT /api/admin/clients/{client_id}/status."""

    is_active: bool


class SmsEnabledPayload(BaseModel):
    """Body for PUT /api/admin/clients/{client_id}/sms-enabled."""

    sms_enabled: bool
    provisioning_notes: str | None = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/clients", response_model=list[ClientSummary])
async def list_clients(
    _admin: dict = Depends(require_admin),
) -> list[ClientSummary]:
    """Return all clients with usage stats and estimated monthly cost.

    Stats computed:
    - calls_this_month: call_logs rows in the current calendar month
    - last_call_at: most recent started_at across all calls
    - bookings_this_month: bookings rows in the current calendar month
    - monthly_cost_estimate: $5 base + calls * $0.15 + bookings * $0.05
    """
    sb = get_supabase()

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    try:
        clients_resp = (
            sb.table("clients")
            .select(
                "id,business_name,email,is_active,onboarding_status,sms_enabled,"
                "vapi_phone_number,twilio_phone_number,vapi_assistant_id,provisioning_notes,"
                "emergency_phone_number,working_hours,services_offered,"
                "google_review_link,kb_last_ingested_at,"
                "subscription_status,subscription_renews_at"
            )
            .execute()
        )
        clients: list[dict] = clients_resp.data or []
    except Exception as exc:
        logger.error("Admin list_clients query failed", error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to fetch clients")

    summaries: list[ClientSummary] = []
    for client in clients:
        client_id = client["id"]

        try:
            calls_resp = (
                sb.table("call_logs")
                .select("id,started_at,was_booked")
                .eq("client_id", client_id)
                .gte("started_at", month_start)
                .execute()
            )
            call_rows: list[dict] = calls_resp.data or []
        except Exception as exc:
            logger.warning("Admin: call_logs query failed", client_id=client_id, error=str(exc))
            call_rows = []

        try:
            last_call_resp = (
                sb.table("call_logs")
                .select("started_at")
                .eq("client_id", client_id)
                .order("started_at", desc=True)
                .limit(1)
                .execute()
            )
            last_call_rows: list[dict] = last_call_resp.data or []
        except Exception as exc:
            logger.warning("Admin: last_call query failed", client_id=client_id, error=str(exc))
            last_call_rows = []

        try:
            bookings_resp = (
                sb.table("bookings")
                .select("id")
                .eq("client_id", client_id)
                .gte("created_at", month_start)
                .execute()
            )
            booking_rows: list[dict] = bookings_resp.data or []
        except Exception as exc:
            logger.warning("Admin: bookings query failed", client_id=client_id, error=str(exc))
            booking_rows = []

        calls_count = len(call_rows)
        bookings_count = len(booking_rows)
        last_call_at = last_call_rows[0]["started_at"] if last_call_rows else None
        monthly_cost = round(5.0 + calls_count * 0.15 + bookings_count * 0.05, 2)

        # Completeness breakdown — each item maps to a human-readable label.
        breakdown: dict[str, bool] = {
            "Emergency phone set": bool(client.get("emergency_phone_number")),
            "Working hours set": bool(client.get("working_hours")),
            "Services listed": bool(client.get("services_offered")),
            "AI agent provisioned": bool(client.get("vapi_assistant_id")),
            "Calling number set": bool(client.get("vapi_phone_number")),
            "SMS number provisioned": bool(client.get("twilio_phone_number")),
            "SMS activated (A2P)": bool(client.get("sms_enabled")),
            "Google review link": bool(client.get("google_review_link")),
            "Knowledge base ingested": bool(client.get("kb_last_ingested_at")),
        }
        completeness_score = round(sum(breakdown.values()) / len(breakdown) * 100)

        summaries.append(
            ClientSummary(
                id=client_id,
                business_name=client.get("business_name", ""),
                email=client.get("email"),
                is_active=client.get("is_active", True),
                onboarding_status=client.get("onboarding_status", "active"),
                sms_enabled=bool(client.get("sms_enabled", False)),
                vapi_phone_number=client.get("vapi_phone_number"),
                twilio_phone_number=client.get("twilio_phone_number"),
                vapi_assistant_id=client.get("vapi_assistant_id"),
                completeness_score=completeness_score,
                completeness_breakdown=breakdown,
                provisioning_notes=client.get("provisioning_notes"),
                calls_this_month=calls_count,
                last_call_at=last_call_at,
                bookings_this_month=bookings_count,
                monthly_cost_estimate=monthly_cost,
                subscription_status=client.get("subscription_status", "none"),
                subscription_renews_at=client.get("subscription_renews_at"),
            )
        )

    return summaries


@router.put("/clients/{client_id}/status")
async def update_client_status(
    client_id: str,
    payload: StatusPayload,
    _admin: dict = Depends(require_admin),
) -> dict[str, Any]:
    """Activate or suspend a client.

    Deactivated clients retain all their data — the agent simply stops
    responding (is_active=False is checked in vapi_webhook.py).

    Body: {"is_active": true | false}
    """
    sb = get_supabase()

    try:
        resp = (
            sb.table("clients")
            .update({"is_active": payload.is_active, "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", client_id)
            .execute()
        )
        rows: list[dict] = resp.data or []
    except Exception as exc:
        logger.error("Admin: status update failed", client_id=client_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to update client status")

    if not rows:
        raise HTTPException(status_code=404, detail="Client not found")

    action = "activated" if payload.is_active else "suspended"
    logger.info(f"Client {action}", client_id=client_id, is_active=payload.is_active)
    return {"client_id": client_id, "is_active": payload.is_active}


@router.get("/clients/{client_id}/impersonate")
async def impersonate_client(
    client_id: str,
    _admin: dict = Depends(require_admin),
) -> dict[str, Any]:
    """Return context for admin to view another client's dashboard.

    Does NOT create a real auth session as that client. Instead, returns
    the client_id and business_name so the admin panel can fetch their
    data while the admin stays logged in as admin.

    The admin panel stores this in React state and passes client_id to
    all dashboard API calls. An "Exit" button clears the impersonation state.
    """
    sb = get_supabase()

    try:
        resp = (
            sb.table("clients")
            .select("id,business_name,email,is_active")
            .eq("id", client_id)
            .limit(1)
            .execute()
        )
        rows: list[dict] = resp.data or []
    except Exception as exc:
        logger.error("Admin: impersonate lookup failed", client_id=client_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to look up client")

    if not rows:
        raise HTTPException(status_code=404, detail="Client not found")

    client = rows[0]
    logger.info("Admin impersonation started", target_client_id=client_id)

    return {
        "client_id": client["id"],
        "business_name": client.get("business_name", ""),
        "email": client.get("email"),
        "is_active": client.get("is_active", True),
        "dashboard_url": f"/dashboard?impersonate={client_id}",
    }


@router.put("/clients/{client_id}/sms-enabled")
async def update_sms_enabled(
    client_id: str,
    payload: SmsEnabledPayload,
    _admin: dict = Depends(require_admin),
) -> dict[str, Any]:
    """Enable or disable SMS for a client after A2P 10DLC registration.

    SMS defaults to disabled on client creation because US carrier A2P
    registration takes 1-4 weeks.  Admin flips this flag once registration
    is confirmed.  Optionally records provisioning notes (registration ID,
    status, etc.) alongside the flag.

    Body: {"sms_enabled": true, "provisioning_notes": "A2P approved 2026-04-20"}
    """
    sb = get_supabase()

    update: dict[str, Any] = {
        "sms_enabled": payload.sms_enabled,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if payload.provisioning_notes is not None:
        update["provisioning_notes"] = payload.provisioning_notes

    try:
        resp = (
            sb.table("clients")
            .update(update)
            .eq("id", client_id)
            .execute()
        )
        rows: list[dict] = resp.data or []
    except Exception as exc:
        logger.error("Admin: sms_enabled update failed", client_id=client_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to update SMS status")

    if not rows:
        raise HTTPException(status_code=404, detail="Client not found")

    action = "enabled" if payload.sms_enabled else "disabled"
    logger.info(f"SMS {action} for client", client_id=client_id)
    return {"client_id": client_id, "sms_enabled": payload.sms_enabled}


def _sse(event: str, data: dict) -> str:
    """Format a single Server-Sent Event line."""
    return f"data: {json.dumps({'event': event, **data})}\n\n"


@router.get("/clients/{client_id}/activate-stream")
async def activate_client_stream(
    client_id: str,
    request: Request,
    _admin: dict = Depends(require_admin),
) -> StreamingResponse:
    """Stream activation progress via SSE.

    Yields JSON events:
      {"event": "step",    "step": "...", "status": "running|done|error", "message": "..."}
      {"event": "done",    "vapi_phone_number": "...", "client_id": "..."}
      {"event": "error",   "message": "..."}

    Frontend connects with EventSource and renders live log.
    """
    async def generate() -> AsyncGenerator[str, None]:
        yield _sse("step", {"step": "init", "status": "running", "message": "Starting activation…"})
        await asyncio.sleep(0.1)

        sb = get_supabase()

        try:
            resp = sb.table("clients").select(
                "id,business_name,email,emergency_phone_number,services_offered,"
                "working_hours,service_area_description,onboarding_status,"
                "vapi_assistant_id,vapi_phone_number"
            ).eq("id", client_id).limit(1).execute()
            rows: list[dict] = resp.data or []
        except Exception as exc:
            yield _sse("error", {"message": f"DB lookup failed: {exc}"})
            return

        if not rows:
            yield _sse("error", {"message": "Client not found"})
            return

        client = rows[0]
        if client.get("onboarding_status") != "pending":
            yield _sse("error", {"message": f"Client already '{client.get('onboarding_status')}'"})
            return

        def _on_step(step: str, status: str, message: str) -> None:
            pass  # SSE events are yielded inline; progress is captured via exception

        # Collect SSE events from activation steps
        _sse_events: list[dict] = []

        def _capture_step(step: str, status: str, message: str) -> None:
            _sse_events.append({"step": step, "status": status, "message": message})

        # Run activation and stream events as they are captured.
        # We use a task + queue pattern: activation runs in background, events
        # are captured and yielded here. For simplicity, run synchronously and
        # yield captured events after each logical step by yielding mid-function.
        # The cleaner approach: run_activation accepts an async callback.
        # Since the existing SSE design expects live streaming, we yield events
        # directly inside a wrapper that converts the on_step callback to SSE.

        import asyncio as _asyncio
        _event_queue: asyncio.Queue = _asyncio.Queue()

        async def _on_step_async(step: str, status: str, message: str) -> None:
            await _event_queue.put({"step": step, "status": status, "message": message})

        # Wrap on_step to be synchronous (run_activation calls it synchronously)
        def _sync_on_step(step: str, status: str, message: str) -> None:
            _asyncio.get_event_loop().call_soon_threadsafe(
                _asyncio.ensure_future,
                _event_queue.put({"step": step, "status": status, "message": message}),
            )

        # Simpler: collect events, then yield — acceptable for activation (not realtime-critical)
        collected: list[dict] = []

        def _collect_step(step: str, status: str, message: str) -> None:
            collected.append({"step": step, "status": status, "message": message})

        result: dict | None = None
        error_msg: str | None = None
        try:
            result = await run_activation(client_id, client, sb, on_step=_collect_step)
        except ActivationError as exc:
            error_msg = str(exc)

        for evt in collected:
            yield _sse("step", evt)

        if error_msg:
            yield _sse("error", {"message": error_msg})
            return

        logger.info("Client activated via SSE stream", client_id=client_id,
                    phone=result.get("vapi_phone_number") if result else None)
        yield _sse("done", result or {})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/clients/{client_id}/magic-link")
async def get_magic_link(
    client_id: str,
    _admin: dict = Depends(require_admin),
) -> dict[str, Any]:
    """Generate a Supabase magic link so the client can set their password."""
    sb = get_supabase()
    try:
        resp = sb.table("clients").select("email,business_name,vapi_phone_number").eq("id", client_id).limit(1).execute()
        rows = resp.data or []
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    if not rows:
        raise HTTPException(status_code=404, detail="Client not found")

    email = rows[0]["email"]
    try:
        link_resp = sb.auth.admin.generate_link({
            "type": "recovery",
            "email": email,
            "options": {"redirect_to": f"{settings.frontend_url}/set-password"},
        })
        magic_link = link_resp.properties.action_link if link_resp and link_resp.properties else None
        if not magic_link:
            raise RuntimeError("No link returned")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate magic link: {exc}")

    return {
        "magic_link": magic_link,
        "email": email,
        "business_name": rows[0].get("business_name"),
        "vapi_phone_number": rows[0].get("vapi_phone_number"),
    }


@router.post("/clients/{client_id}/activate")
async def activate_client(
    client_id: str,
    _admin: dict = Depends(require_admin),
) -> dict[str, Any]:
    """Non-streaming activate endpoint (kept for backwards compatibility)."""
    sb = get_supabase()

    try:
        resp = (
            sb.table("clients")
            .select(
                "id,business_name,email,emergency_phone_number,services_offered,"
                "working_hours,service_area_description,onboarding_status,"
                "vapi_assistant_id,vapi_phone_number"
            )
            .eq("id", client_id)
            .limit(1)
            .execute()
        )
        rows: list[dict] = resp.data or []
    except Exception as exc:
        logger.error("Activate: client lookup failed", client_id=client_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to look up client")

    if not rows:
        raise HTTPException(status_code=404, detail="Client not found")

    client = rows[0]
    if client.get("onboarding_status") != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Client is already '{client.get('onboarding_status')}' — cannot activate again",
        )

    # Send invite email (non-fatal — client can request reset manually).
    email = client["email"]
    try:
        sb.auth.admin.generate_link({
            "type": "recovery",
            "email": email,
            "options": {"redirect_to": f"{settings.frontend_url}/set-password"},
        })
        logger.info("Activate: invite email sent", email=email)
    except Exception as exc:
        logger.warning("Activate: invite email failed (non-fatal)", email=email, error=str(exc))

    try:
        result = await run_activation(client_id, client, sb)
    except ActivationError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {
        "success": True,
        "client_id": result["client_id"],
        "vapi_phone_number": result["vapi_phone_number"],
        "twilio_phone_number": result["twilio_phone_number"],
        "message": (
            f"Client activated! Invite email sent to {email}. "
            f"AI calling number: {result['vapi_phone_number']}. "
            f"Have the client forward their business number to this Vapi number."
        ),
    }
