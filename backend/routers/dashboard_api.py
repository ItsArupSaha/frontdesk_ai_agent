"""
Dashboard API routes — all require a valid Supabase JWT.

GET  /api/auth/me              → current user identity (is_admin flag)
GET  /api/dashboard/overview   → summary metrics for the client
GET  /api/dashboard/calls      → paginated call log
GET  /api/dashboard/bookings   → bookings in a date range
GET  /api/dashboard/analytics  → time-series data (calls/bookings per day)
GET  /api/dashboard/settings   → client config (no sensitive keys)
PUT  /api/dashboard/settings   → update client config
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from backend.db.client import get_supabase
from backend.utils.logging import get_logger
from backend.utils.auth import get_current_user as _get_current_user, is_admin as _is_admin

logger = get_logger(__name__)
router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

# Separate router for auth-level endpoints (no /api/dashboard prefix).
auth_router = APIRouter(prefix="/api/auth", tags=["auth"])

_bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------


async def _require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict[str, Any]:
    """Verify the Supabase JWT and return the decoded user payload.

    In development (APP_ENV != production) we accept the special token
    ``dev-bypass`` so that integration tests don't need a real Supabase JWT.
    """
    from backend.config import settings

    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = credentials.credentials

    # Dev bypass — only allowed outside production.
    if settings.app_env != "production" and token == "dev-bypass":
        return {"sub": "dev-user", "role": "authenticated"}

    # Verify with Supabase (the service-key client can call auth.get_user).
    try:
        sb = get_supabase()
        resp = sb.auth.get_user(token)
        if resp is None or resp.user is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return {"sub": resp.user.id, "email": resp.user.email, "role": "authenticated"}
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("JWT verification failed", error=str(exc))
        raise HTTPException(status_code=401, detail="Token verification failed")


# ---------------------------------------------------------------------------
# GET /api/auth/me — identity endpoint (no client_id needed)
# ---------------------------------------------------------------------------


@auth_router.get("/me")
async def get_me(
    user: dict = Depends(_get_current_user),
) -> dict[str, Any]:
    """Return the current user's identity and role.

    Used by the frontend AuthContext to determine whether to show the
    admin panel or the client dashboard — without needing a clients row.

    Admins are identified via the `admins` table. Clients have a row in
    `clients` but no row in `admins`. The two are mutually exclusive.

    Returns:
        user_id: Supabase auth user UUID.
        email: User's email from auth.
        is_admin: True if the user is in the admins table.
    """
    admin = await _is_admin(user["sub"])
    return {
        "user_id": user["sub"],
        "email": user.get("email"),
        "is_admin": admin,
    }


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class OverviewResponse(BaseModel):
    """Summary metrics returned by GET /api/dashboard/overview."""

    calls_today: int
    calls_this_week: int
    bookings_this_week: int
    booking_rate: float
    emergencies_this_week: int
    missed_calls_recovered: int


class SettingsPayload(BaseModel):
    """Body accepted by PUT /api/dashboard/settings."""

    business_name: str | None = None
    emergency_phone_number: str | None = None
    working_hours: dict | None = None
    services_offered: list[str] | None = None
    service_area_description: str | None = None
    google_review_link: str | None = None
    jobber_api_key: str | None = None
    housecall_pro_api_key: str | None = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/overview", response_model=OverviewResponse)
async def get_overview(
    client_id: str = Query(..., description="Client UUID"),
    _user: dict = Depends(_require_auth),
) -> OverviewResponse:
    """Return high-level KPI metrics for the client's dashboard home page.

    Queries call_logs and reminders_queue to compute:
    - Calls today / this week
    - Bookings this week
    - Emergency count this week
    - Missed-call recovery count this week
    """
    sb = get_supabase()

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    # ISO strings — Supabase accepts these in .gte() / .lt() filters.
    today_iso = today_start.isoformat()

    # Monday of the current week (weekday() == 0 for Monday).
    days_since_monday = now.weekday()
    week_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = week_start.replace(day=now.day - days_since_monday)
    week_iso = week_start.isoformat()

    try:
        # All calls this week for the client.
        calls_week_resp = (
            sb.table("call_logs")
            .select("id,was_emergency,was_booked,started_at")
            .eq("client_id", client_id)
            .gte("started_at", week_iso)
            .execute()
        )
        calls_week: list[dict] = calls_week_resp.data or []

        calls_today = sum(
            1
            for c in calls_week
            if c.get("started_at", "") >= today_iso
        )
        calls_this_week = len(calls_week)
        bookings_this_week = sum(1 for c in calls_week if c.get("was_booked"))
        emergencies_this_week = sum(1 for c in calls_week if c.get("was_emergency"))
        booking_rate = (
            round(bookings_this_week / calls_this_week, 4) if calls_this_week else 0.0
        )

        # Missed-call recoveries sent this week.
        recovery_resp = (
            sb.table("reminders_queue")
            .select("id")
            .eq("client_id", client_id)
            .eq("type", "missed_call_recovery")
            .eq("sent", True)
            .gte("sent_at", week_iso)
            .execute()
        )
        missed_calls_recovered = len(recovery_resp.data or [])

    except Exception as exc:
        logger.error("Overview query failed", client_id=client_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to fetch overview metrics")

    return OverviewResponse(
        calls_today=calls_today,
        calls_this_week=calls_this_week,
        bookings_this_week=bookings_this_week,
        booking_rate=booking_rate,
        emergencies_this_week=emergencies_this_week,
        missed_calls_recovered=missed_calls_recovered,
    )


@router.get("/calls")
async def get_calls(
    client_id: str = Query(...),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    emergency_only: bool = Query(False),
    booked_only: bool = Query(False),
    start: str | None = Query(None, description="ISO datetime filter start"),
    end: str | None = Query(None, description="ISO datetime filter end"),
    _user: dict = Depends(_require_auth),
) -> dict[str, Any]:
    """Return paginated call logs for the client.

    Supports optional filters: emergency_only, booked_only, date range.
    Each row includes summary, duration, was_emergency, was_booked, and
    transcript (for expand-on-click in the UI).
    """
    sb = get_supabase()

    try:
        query = (
            sb.table("call_logs")
            .select(
                "id,call_id,caller_number,started_at,ended_at,"
                "was_emergency,was_booked,summary,transcript,status,recording_url"
            )
            .eq("client_id", client_id)
            .order("started_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if emergency_only:
            query = query.eq("was_emergency", True)
        if booked_only:
            query = query.eq("was_booked", True)
        if start:
            query = query.gte("started_at", start)
        if end:
            query = query.lte("started_at", end)

        resp = query.execute()
        rows: list[dict] = resp.data or []

        # Compute duration_seconds from started_at / ended_at.
        for row in rows:
            row["duration_seconds"] = _compute_duration(
                row.get("started_at"), row.get("ended_at")
            )

    except Exception as exc:
        logger.error("Calls query failed", client_id=client_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to fetch call logs")

    return {"calls": rows, "offset": offset, "limit": limit, "count": len(rows)}


@router.get("/bookings")
async def get_bookings(
    client_id: str = Query(...),
    start: str | None = Query(None, description="ISO date range start"),
    end: str | None = Query(None, description="ISO date range end"),
    _user: dict = Depends(_require_auth),
) -> dict[str, Any]:
    """Return bookings in an optional date range for the client.

    Used by the Bookings page (calendar + list views).
    """
    sb = get_supabase()

    try:
        query = (
            sb.table("bookings")
            .select(
                "id,caller_name,caller_phone,caller_address,"
                "problem_description,appointment_start,appointment_end,"
                "status,confirmation_sms_sent,fsm_synced,created_at"
            )
            .eq("client_id", client_id)
            .order("appointment_start", desc=False)
        )
        if start:
            query = query.gte("appointment_start", start)
        if end:
            query = query.lte("appointment_start", end)

        resp = query.execute()
        bookings: list[dict] = resp.data or []

    except Exception as exc:
        logger.error("Bookings query failed", client_id=client_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to fetch bookings")

    return {"bookings": bookings, "count": len(bookings)}


@router.get("/analytics")
async def get_analytics(
    client_id: str = Query(...),
    period: str = Query("30d", pattern=r"^\d+d$"),
    _user: dict = Depends(_require_auth),
) -> dict[str, Any]:
    """Return time-series call/booking data for the Analytics page charts.

    ``period`` accepts strings like ``30d``, ``7d``, ``90d``.
    Returns:
    - calls_per_day: [{date, count}]
    - bookings_per_day: [{date, count}]
    - calls_by_hour: [{hour, count}]  (0-23)
    - emergency_rate: float
    """
    sb = get_supabase()

    # Parse period (e.g. "30d" → 30 days).
    days = int(period.rstrip("d"))
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    period_start = (now - timedelta(days=days)).isoformat()

    try:
        resp = (
            sb.table("call_logs")
            .select("started_at,was_emergency,was_booked")
            .eq("client_id", client_id)
            .gte("started_at", period_start)
            .execute()
        )
        rows: list[dict] = resp.data or []
    except Exception as exc:
        logger.error("Analytics query failed", client_id=client_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to fetch analytics data")

    # Aggregate per-day counts.
    calls_by_date: dict[str, int] = {}
    bookings_by_date: dict[str, int] = {}
    calls_by_hour: dict[int, int] = {h: 0 for h in range(24)}
    total_calls = len(rows)
    total_emergencies = 0

    for row in rows:
        raw_ts: str = row.get("started_at", "")
        try:
            # Supabase returns ISO strings; strip trailing timezone offset if needed.
            dt = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
        except ValueError:
            continue

        date_key = dt.strftime("%Y-%m-%d")
        calls_by_date[date_key] = calls_by_date.get(date_key, 0) + 1
        if row.get("was_booked"):
            bookings_by_date[date_key] = bookings_by_date.get(date_key, 0) + 1
        if row.get("was_emergency"):
            total_emergencies += 1
        calls_by_hour[dt.hour] = calls_by_hour.get(dt.hour, 0) + 1

    emergency_rate = round(total_emergencies / total_calls, 4) if total_calls else 0.0

    return {
        "calls_per_day": [
            {"date": d, "count": c} for d, c in sorted(calls_by_date.items())
        ],
        "bookings_per_day": [
            {"date": d, "count": c} for d, c in sorted(bookings_by_date.items())
        ],
        "calls_by_hour": [
            {"hour": h, "count": calls_by_hour[h]} for h in range(24)
        ],
        "emergency_rate": emergency_rate,
        "period_days": days,
    }


@router.get("/settings")
async def get_settings(
    client_id: str = Query(...),
    _user: dict = Depends(_require_auth),
) -> dict[str, Any]:
    """Return the client's configuration (excluding sensitive API keys).

    Sensitive columns (jobber_api_key, housecall_pro_api_key,
    google_calendar_refresh_token_enc) are intentionally omitted.
    """
    sb = get_supabase()

    try:
        resp = (
            sb.table("clients")
            .select(
                "id,business_name,emergency_phone_number,working_hours,"
                "services_offered,service_area_description,google_review_link,"
                "vapi_assistant_id,twilio_phone_number,is_active,"
                "fsm_type,created_at,updated_at"
            )
            .eq("id", client_id)
            .limit(1)
            .execute()
        )
        rows: list[dict] = resp.data or []
    except Exception as exc:
        logger.error("Settings query failed", client_id=client_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to fetch settings")

    if not rows:
        raise HTTPException(status_code=404, detail="Client not found")

    return rows[0]


@router.put("/settings")
async def update_settings(
    client_id: str = Query(...),
    payload: SettingsPayload = ...,
    _user: dict = Depends(_require_auth),
) -> dict[str, Any]:
    """Update client configuration fields.

    Only non-None fields in the payload are written.
    If services_offered or service_area_description changed, the caller
    should trigger a knowledge-base re-ingestion (handled client-side or
    via a separate endpoint in a future phase).
    """
    sb = get_supabase()

    # Build the update dict — skip None values.
    update: dict[str, Any] = {}
    if payload.business_name is not None:
        update["business_name"] = payload.business_name
    if payload.emergency_phone_number is not None:
        update["emergency_phone_number"] = payload.emergency_phone_number
    if payload.working_hours is not None:
        update["working_hours"] = payload.working_hours
    if payload.services_offered is not None:
        update["services_offered"] = payload.services_offered
    if payload.service_area_description is not None:
        update["service_area_description"] = payload.service_area_description
    if payload.google_review_link is not None:
        update["google_review_link"] = payload.google_review_link
    # API keys — stored as plain text in DB (encrypted at rest by Supabase).
    if payload.jobber_api_key is not None:
        update["jobber_api_key"] = payload.jobber_api_key
    if payload.housecall_pro_api_key is not None:
        update["housecall_pro_api_key"] = payload.housecall_pro_api_key

    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")

    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        resp = (
            sb.table("clients")
            .update(update)
            .eq("id", client_id)
            .execute()
        )
        rows: list[dict] = resp.data or []
    except Exception as exc:
        logger.error("Settings update failed", client_id=client_id, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to update settings")

    if not rows:
        raise HTTPException(status_code=404, detail="Client not found")

    logger.info("Client settings updated", client_id=client_id, fields=list(update.keys()))

    # Return the updated record (minus sensitive keys).
    updated = rows[0]
    updated.pop("jobber_api_key", None)
    updated.pop("housecall_pro_api_key", None)
    updated.pop("google_calendar_refresh_token_enc", None)
    return updated


# ---------------------------------------------------------------------------
# Booking status update
# ---------------------------------------------------------------------------


@router.patch("/bookings/{booking_id}")
async def update_booking_status(
    booking_id: str,
    client_id: str = Query(...),
    status: str = Query(..., pattern=r"^(confirmed|completed|cancelled)$"),
    _user: dict = Depends(_require_auth),
) -> dict[str, Any]:
    """Mark a booking as completed or cancelled.

    Used by the Bookings page "Mark as completed" action.
    client_id is required for multi-tenant isolation.
    """
    sb = get_supabase()

    try:
        resp = (
            sb.table("bookings")
            .update({"status": status, "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", booking_id)
            .eq("client_id", client_id)
            .execute()
        )
        rows: list[dict] = resp.data or []
    except Exception as exc:
        logger.error(
            "Booking status update failed",
            booking_id=booking_id,
            client_id=client_id,
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail="Failed to update booking")

    if not rows:
        raise HTTPException(status_code=404, detail="Booking not found")

    return rows[0]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _compute_duration(started_at: str | None, ended_at: str | None) -> int | None:
    """Return call duration in seconds, or None if timestamps are missing."""
    if not started_at or not ended_at:
        return None
    try:
        start_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(ended_at.replace("Z", "+00:00"))
        return max(0, int((end_dt - start_dt).total_seconds()))
    except ValueError:
        return None
