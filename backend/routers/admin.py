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

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from backend.config import settings
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


@router.post("/clients/{client_id}/activate")
async def activate_client(
    client_id: str,
    _admin: dict = Depends(require_admin),
) -> dict[str, Any]:
    """Provision a pending client: Supabase user + Vapi assistant + phone numbers.

    Called by admin after reviewing a self-service onboarding submission.
    The pending client record already exists in the DB (created by
    POST /api/onboarding/submit).  This endpoint:
      1. Validates client exists and is still pending
      2. Creates Supabase auth user with the same UUID as the pending client
      3. Sends password-set invite email
      4. Creates Vapi assistant
      5. Buys Vapi phone number (for calls)
      6. Provisions Twilio number (for SMS)
      7. Sets onboarding_status='active', is_active=true

    Full rollback on steps 2–6 failure (same pattern as create_client).
    """
    sb = get_supabase()

    # Fetch the pending client record.
    try:
        resp = (
            sb.table("clients")
            .select("id,business_name,email,emergency_phone_number,services_offered,working_hours,service_area_description,onboarding_status")
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

    email = client["email"]
    business_name = client.get("business_name", "")
    client_config = {
        "business_name": business_name,
        "emergency_phone_number": client.get("emergency_phone_number", ""),
        "services_offered": client.get("services_offered") or [],
        "working_hours": client.get("working_hours") or {},
        "service_area_description": client.get("service_area_description", ""),
    }

    vapi_assistant_id: str | None = None
    vapi_phone_id: str | None = None
    vapi_phone_number: str | None = None
    twilio_phone_number: str | None = None

    from backend.routers.onboarding import (
        _generate_temp_password,
        _rollback_supabase_user,
        _rollback_vapi_assistant,
        _rollback_vapi_phone,
        _rollback_db_client,
    )
    import httpx as _httpx

    # -----------------------------------------------------------------------
    # Step 1: Create Supabase auth user — skip if already exists (retry-safe).
    # -----------------------------------------------------------------------
    _supabase_user_existed = False
    try:
        existing_user = sb.auth.admin.get_user_by_id(client_id)
        if existing_user and existing_user.user:
            _supabase_user_existed = True
            logger.info("Activate: Supabase auth user already exists, reusing", client_id=client_id)
    except Exception:
        pass

    if not _supabase_user_existed:
        try:
            create_resp = sb.auth.admin.create_user({
                "id": client_id,
                "email": email,
                "email_confirm": True,
                "password": _generate_temp_password(),
            })
            if create_resp is None or create_resp.user is None:
                raise RuntimeError("Supabase returned no user")
            logger.info("Activate: Supabase auth user created", client_id=client_id, email=email)
        except Exception as exc:
            logger.error("Activate step 1 failed: Supabase user creation", client_id=client_id, error=str(exc))
            raise HTTPException(status_code=500, detail=f"Failed to create auth user: {exc}")

    # Send invite / password-set email.
    try:
        sb.auth.admin.generate_link({"type": "recovery", "email": email})
        logger.info("Activate: invite email sent", email=email)
    except Exception as exc:
        logger.warning("Activate: invite email failed (non-fatal)", email=email, error=str(exc))

    # -----------------------------------------------------------------------
    # Step 2: Create Vapi assistant — reuse if DB already has a valid one.
    # -----------------------------------------------------------------------
    _existing_assistant_id: str | None = client.get("vapi_assistant_id") or (
        sb.table("clients").select("vapi_assistant_id").eq("id", client_id).limit(1).execute().data or [{}]
    )[0].get("vapi_assistant_id")

    _assistant_valid = False
    if _existing_assistant_id:
        try:
            async with _httpx.AsyncClient(timeout=10) as _hc:
                _r = await _hc.get(
                    f"https://api.vapi.ai/assistant/{_existing_assistant_id}",
                    headers={"Authorization": f"Bearer {settings.vapi_api_key}"},
                )
            if _r.status_code == 200:
                _assistant_valid = True
                vapi_assistant_id = _existing_assistant_id
                logger.info("Activate: reusing existing Vapi assistant", client_id=client_id, assistant_id=vapi_assistant_id)
        except Exception:
            pass

    if not _assistant_valid:
        try:
            from backend.services.vapi_service import create_assistant
            vapi_assistant_id = await create_assistant(client_config, client_id)
            sb.table("clients").update({"vapi_assistant_id": vapi_assistant_id}).eq("id", client_id).execute()
            logger.info("Activate: Vapi assistant created", client_id=client_id, assistant_id=vapi_assistant_id)
        except Exception as exc:
            logger.error("Activate step 2 failed: Vapi assistant", client_id=client_id, error=str(exc))
            if not _supabase_user_existed:
                _rollback_supabase_user(sb, client_id)
            raise HTTPException(status_code=500, detail=f"Failed to create Vapi assistant: {exc}")

    # -----------------------------------------------------------------------
    # Step 3: Buy Vapi phone number — reuse if DB already has a valid one.
    # -----------------------------------------------------------------------
    _existing_vapi_phone: str | None = (
        sb.table("clients").select("vapi_phone_number").eq("id", client_id).limit(1).execute().data or [{}]
    )[0].get("vapi_phone_number")

    _phone_valid = False
    if _existing_vapi_phone:
        # Verify the number still exists in Vapi by listing and matching.
        try:
            async with _httpx.AsyncClient(timeout=10) as _hc:
                _r = await _hc.get(
                    "https://api.vapi.ai/phone-number",
                    headers={"Authorization": f"Bearer {settings.vapi_api_key}"},
                )
            if _r.status_code == 200:
                _existing_numbers = {n.get("number") for n in _r.json()}
                if _existing_vapi_phone in _existing_numbers:
                    _phone_valid = True
                    vapi_phone_number = _existing_vapi_phone
                    logger.info("Activate: reusing existing Vapi phone number", client_id=client_id, phone=vapi_phone_number)
                else:
                    # Stale — clear DB field so panel doesn't show wrong number.
                    sb.table("clients").update({"vapi_phone_number": None}).eq("id", client_id).execute()
                    logger.info("Activate: cleared stale vapi_phone_number from DB", client_id=client_id, stale=_existing_vapi_phone)
        except Exception:
            pass

    # Derive area_code from emergency_phone_number if available, else default 212.
    emergency_phone = client.get("emergency_phone_number", "+12120000000")
    area_code = emergency_phone[2:5] if len(emergency_phone) >= 5 else "212"

    if not _phone_valid:
        try:
            from backend.services.vapi_service import buy_phone_number
            vapi_phone_id, vapi_phone_number = await buy_phone_number(
                area_code=area_code,
                assistant_id=vapi_assistant_id,
                client_id=client_id,
                business_name=business_name,
            )
            sb.table("clients").update({"vapi_phone_number": vapi_phone_number}).eq("id", client_id).execute()
            logger.info("Activate: Vapi phone bought", client_id=client_id, phone=vapi_phone_number)
        except Exception as exc:
            logger.error("Activate step 3 failed: Vapi phone", client_id=client_id, error=str(exc))
            if not _assistant_valid:
                # Only delete assistant if we created it this run.
                _rollback_vapi_assistant(vapi_assistant_id)
                try:
                    sb.table("clients").update({"vapi_assistant_id": None}).eq("id", client_id).execute()
                except Exception:
                    pass
            if not _supabase_user_existed:
                _rollback_supabase_user(sb, client_id)
            raise HTTPException(status_code=500, detail=f"Failed to buy calling number: {exc}")

    # Step 4: Provision Twilio SMS number (non-blocking — SMS requires A2P registration).
    # Failure here does NOT block activation. Admin enables SMS manually after A2P approval.
    try:
        from backend.services.twilio_service import provision_number
        twilio_phone_number = await provision_number(area_code, client_id)
        sb.table("clients").update({"twilio_phone_number": twilio_phone_number}).eq("id", client_id).execute()
        logger.info("Activate: Twilio number provisioned", client_id=client_id, phone=twilio_phone_number)
    except Exception as exc:
        logger.warning(
            "Activate step 4: Twilio number skipped (non-fatal) — admin must provision manually after A2P approval",
            client_id=client_id,
            error=str(exc),
        )

    # Step 5: Mark client as active.
    try:
        sb.table("clients").update({
            "onboarding_status": "active",
            "is_active": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", client_id).execute()
        logger.info("Client activated successfully", client_id=client_id)
    except Exception as exc:
        logger.error("Activate step 5 failed: status update", client_id=client_id, error=str(exc))
        raise HTTPException(status_code=500, detail=f"Provisioning done but status update failed: {exc}")

    # Non-critical: ingest knowledge base.
    try:
        from backend.services.rag_service import ingest_client_knowledge
        await ingest_client_knowledge(client_id, client_config)
        logger.info("Activate: KB ingested", client_id=client_id)
    except Exception as exc:
        logger.warning("Activate: KB ingestion failed (non-critical)", client_id=client_id, error=str(exc))

    return {
        "success": True,
        "client_id": client_id,
        "vapi_phone_number": vapi_phone_number,
        "twilio_phone_number": twilio_phone_number,
        "message": (
            f"Client activated! Invite email sent to {email}. "
            f"AI calling number: {vapi_phone_number}. "
            f"Have the client forward their business number to this Vapi number."
        ),
    }
