"""
Admin-only API routes for multi-client management.

All routes require admin role (verified via require_admin dependency).
Non-admin users receive 403 Forbidden.

Routes:
    GET  /api/admin/clients                       — list all clients with stats
    PUT  /api/admin/clients/{client_id}/status    — activate / suspend client
    GET  /api/admin/clients/{client_id}/impersonate — get context to view their dashboard
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.db.client import get_supabase
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
    sms_enabled: bool
    twilio_phone_number: str | None
    vapi_assistant_id: str | None
    completeness_score: int  # 0-100
    completeness_breakdown: dict[str, bool]  # item_label → done
    provisioning_notes: str | None
    calls_this_month: int
    last_call_at: str | None
    bookings_this_month: int
    monthly_cost_estimate: float


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
                "id,business_name,email,is_active,sms_enabled,"
                "twilio_phone_number,vapi_assistant_id,provisioning_notes,"
                "emergency_phone_number,working_hours,services_offered,"
                "google_review_link,kb_last_ingested_at"
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
            "Phone number provisioned": bool(client.get("twilio_phone_number")),
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
                sms_enabled=bool(client.get("sms_enabled", False)),
                twilio_phone_number=client.get("twilio_phone_number"),
                vapi_assistant_id=client.get("vapi_assistant_id"),
                completeness_score=completeness_score,
                completeness_breakdown=breakdown,
                provisioning_notes=client.get("provisioning_notes"),
                calls_this_month=calls_count,
                last_call_at=last_call_at,
                bookings_this_month=bookings_count,
                monthly_cost_estimate=monthly_cost,
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
