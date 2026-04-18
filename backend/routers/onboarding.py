"""
Client onboarding routes.

Handles:
  1. Google OAuth2 flow for connecting a client's Google Calendar.
  2. POST /api/clients/create — full 7-step client creation with rollback.

The client creation endpoint runs steps IN ORDER. If any critical step fails,
it rolls back everything created so far and returns a clear error. RAG ingestion
(step 6) is non-critical — failure is logged but does NOT trigger rollback.

Steps:
  1. Validate input
  2. Create Supabase auth user + send password-reset email
  3. Insert clients row in DB
  4. Create Vapi assistant
  5. Provision Twilio phone number
  6. Ingest knowledge base (non-critical)
  7. Return success payload
"""
from __future__ import annotations

import re
import secrets
import string
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from backend.utils.limiter import limiter
from pydantic import BaseModel, field_validator

from backend.db.client import get_supabase
from backend.services.calendar_service import (
    CalendarAuthError,
    get_oauth_url,
    handle_oauth_callback,
)
from backend.utils.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Google OAuth helpers (unchanged from Phase 3)
# ---------------------------------------------------------------------------

_SUCCESS_HTML = """
<html>
<body style="font-family:sans-serif;text-align:center;padding:60px">
<h2>&#10003; Google Calendar connected!</h2>
<p>You can close this tab and return to setup.</p>
</body>
</html>
""".strip()

_ERROR_HTML = """
<html>
<body style="font-family:sans-serif;text-align:center;padding:60px">
<h2>&#10007; Connection failed</h2>
<p>{error}</p>
<p>Please close this tab, revoke Google Calendar access in your Google account,
and try the &ldquo;Connect Calendar&rdquo; button again.</p>
</body>
</html>
""".strip()


@router.get("/auth/google/connect")
async def google_connect(client_id: str) -> RedirectResponse:
    """Redirect the browser to Google's OAuth consent screen.

    Query params:
        client_id: Internal client UUID.
    """
    auth_url = get_oauth_url(client_id)
    return RedirectResponse(url=auth_url)


@router.get("/auth/google/callback")
async def google_callback(code: str, state: str) -> HTMLResponse:
    """Handle Google's redirect back after user grants consent.

    Query params:
        code: Authorisation code from Google.
        state: Client UUID that was passed as the OAuth state parameter.
    """
    client_id = state
    try:
        await handle_oauth_callback(code, client_id)
        return HTMLResponse(content=_SUCCESS_HTML, status_code=200)
    except CalendarAuthError as exc:
        logger.error("Google OAuth callback error", client_id=client_id, error=str(exc))
        error_html = _ERROR_HTML.format(error=str(exc))
        return HTMLResponse(content=error_html, status_code=400)


# ---------------------------------------------------------------------------
# Client creation — POST /api/clients/create
# ---------------------------------------------------------------------------

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_E164_RE = re.compile(r"^\+1[2-9]\d{9}$")  # US E.164


class ClientCreatePayload(BaseModel):
    """Input for POST /api/clients/create."""

    business_name: str
    email: str
    emergency_phone: str
    services_offered: list[str] = []
    working_hours: dict[str, Any] = {}
    service_area_description: str = ""
    zip_codes: list[str] = []
    area_code: str = "212"
    pricing_ranges: dict[str, str] = {}
    fsm_type: str | None = None
    jobber_api_key: str | None = None
    housecall_pro_api_key: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Ensure email is a valid format."""
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email format")
        return v.lower().strip()

    @field_validator("emergency_phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Ensure emergency_phone is US E.164 format (+1XXXXXXXXXX)."""
        if not _E164_RE.match(v):
            raise ValueError("emergency_phone must be US E.164 format: +1XXXXXXXXXX")
        return v

    @field_validator("business_name")
    @classmethod
    def validate_business_name(cls, v: str) -> str:
        """Ensure business_name is not empty."""
        if not v.strip():
            raise ValueError("business_name is required")
        return v.strip()

    @field_validator("area_code")
    @classmethod
    def validate_area_code(cls, v: str) -> str:
        """Ensure area_code is exactly 3 digits."""
        if not re.fullmatch(r"\d{3}", v):
            raise ValueError("area_code must be exactly 3 digits")
        return v


def _generate_temp_password(length: int = 16) -> str:
    """Generate a cryptographically random temporary password.

    The password is immediately invalidated by the password-reset email,
    so strength matters less than uniqueness.
    """
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("/api/clients/create")
@limiter.limit("10/minute")
async def create_client(request: Request, payload: ClientCreatePayload) -> dict[str, Any]:
    """Create a new client with full provisioning in 7 ordered steps.

    This is the most critical endpoint in Phase 7. Steps run IN ORDER.
    If any step from 2–5 fails, all previously created resources are
    rolled back to prevent partial state in the DB.

    Step 6 (RAG ingestion) is non-critical — failure is logged but does
    NOT trigger rollback.

    Returns:
        JSON with client_id, phone_number, and setup instructions.

    Raises:
        HTTPException 422: input validation failed.
        HTTPException 500: any critical step failed (after rollback).
    """
    # -----------------------------------------------------------------------
    # Step 1: Validate input (Pydantic handles this — 422 on failure)
    # -----------------------------------------------------------------------
    sb = get_supabase()
    user_id: str | None = None
    vapi_assistant_id: str | None = None
    twilio_phone_number: str | None = None

    client_config = {
        "business_name": payload.business_name,
        "emergency_phone_number": payload.emergency_phone,
        "services_offered": payload.services_offered,
        "working_hours": payload.working_hours,
        "service_area_description": payload.service_area_description,
    }

    # -----------------------------------------------------------------------
    # Step 2: Create Supabase auth user + send password-reset email
    # -----------------------------------------------------------------------
    try:
        create_resp = sb.auth.admin.create_user({
            "email": payload.email,
            "email_confirm": True,
            "password": _generate_temp_password(),
        })
        if create_resp is None or create_resp.user is None:
            raise RuntimeError("Supabase returned no user")
        user_id = create_resp.user.id
        logger.info("Supabase auth user created", user_id=user_id, email=payload.email)
    except Exception as exc:
        logger.error("Step 2 failed: Supabase user creation", email=payload.email, error=str(exc))
        raise HTTPException(status_code=500, detail=f"Failed to create auth user: {exc}")

    # Send password-reset / set-password email.
    try:
        sb.auth.admin.generate_link({
            "type": "recovery",
            "email": payload.email,
        })
        logger.info("Password reset email sent", email=payload.email)
    except Exception as exc:
        # Non-fatal: user can request reset manually. Log and continue.
        logger.warning("Password reset email failed (non-fatal)", email=payload.email, error=str(exc))

    # -----------------------------------------------------------------------
    # Step 3: Insert clients row in DB
    # -----------------------------------------------------------------------
    try:
        db_row = {
            "id": user_id,
            "business_name": payload.business_name,
            "email": payload.email,
            "emergency_phone_number": payload.emergency_phone,
            "services_offered": payload.services_offered,
            "working_hours": payload.working_hours,
            "service_area_description": payload.service_area_description,
            "is_active": True,
            # SMS disabled by default — US A2P 10DLC carrier registration required.
            # Voice calls work immediately.  Admin enables SMS after registration.
            "sms_enabled": False,
            # No 'role' column — clients table is for client businesses only.
            # Admin identity lives in the separate 'admins' table.
            "vapi_assistant_id": None,
            "twilio_phone_number": None,
            "fsm_type": payload.fsm_type,
            "jobber_api_key": payload.jobber_api_key or "",
            "housecall_pro_api_key": payload.housecall_pro_api_key or "",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        sb.table("clients").insert(db_row).execute()
        logger.info("Client DB record created", client_id=user_id)
    except Exception as exc:
        logger.error("Step 3 failed: DB insert", client_id=user_id, error=str(exc))
        # Rollback: delete Supabase user.
        _rollback_supabase_user(sb, user_id)
        raise HTTPException(status_code=500, detail=f"Failed to create client record: {exc}")

    # -----------------------------------------------------------------------
    # Step 4: Create Vapi assistant
    # -----------------------------------------------------------------------
    try:
        from backend.services.vapi_service import create_assistant, VapiServiceError
        vapi_assistant_id = await create_assistant(client_config, user_id)
        # Persist assistant_id immediately.
        sb.table("clients").update(
            {"vapi_assistant_id": vapi_assistant_id}
        ).eq("id", user_id).execute()
        logger.info("Vapi assistant provisioned", client_id=user_id, assistant_id=vapi_assistant_id)
    except Exception as exc:
        logger.error("Step 4 failed: Vapi assistant creation", client_id=user_id, error=str(exc))
        _rollback_db_client(sb, user_id)
        _rollback_supabase_user(sb, user_id)
        raise HTTPException(status_code=500, detail=f"Failed to create Vapi assistant: {exc}")

    # -----------------------------------------------------------------------
    # Step 5: Provision Twilio phone number
    # -----------------------------------------------------------------------
    try:
        from backend.services.twilio_service import provision_number, TwilioProvisionError
        twilio_phone_number = await provision_number(payload.area_code, user_id)
        sb.table("clients").update(
            {"twilio_phone_number": twilio_phone_number}
        ).eq("id", user_id).execute()
        logger.info("Twilio number provisioned", client_id=user_id, phone=twilio_phone_number)
    except Exception as exc:
        logger.error("Step 5 failed: Twilio provisioning", client_id=user_id, error=str(exc))
        _rollback_vapi_assistant(vapi_assistant_id)
        _rollback_db_client(sb, user_id)
        _rollback_supabase_user(sb, user_id)
        raise HTTPException(status_code=500, detail=f"Failed to provision phone number: {exc}")

    # -----------------------------------------------------------------------
    # Step 6: Ingest knowledge base (non-critical)
    # -----------------------------------------------------------------------
    try:
        from backend.services.rag_service import ingest_client_knowledge
        await ingest_client_knowledge(user_id, client_config)
        logger.info("Knowledge base ingested", client_id=user_id)
    except Exception as exc:
        # RAG failure is non-critical — client can still use the product.
        # Re-ingest from Settings page later.
        logger.warning(
            "Step 6: RAG ingestion failed (non-critical, can re-ingest from Settings)",
            client_id=user_id,
            error=str(exc),
        )

    # -----------------------------------------------------------------------
    # Step 7: Return success
    # -----------------------------------------------------------------------
    logger.info(
        "Client onboarding complete",
        client_id=user_id,
        phone_number=twilio_phone_number,
    )
    return {
        "client_id": user_id,
        "phone_number": twilio_phone_number,
        "setup_complete": True,
        "next_step": "forward_calls_instruction",
        "message": (
            f"Agent is live! Forward calls to {twilio_phone_number}. "
            f"An email has been sent to {payload.email} to set their password."
        ),
    }


# ---------------------------------------------------------------------------
# Rollback helpers
# ---------------------------------------------------------------------------


def _rollback_supabase_user(sb: Any, user_id: str | None) -> None:
    """Delete Supabase auth user during rollback (best-effort)."""
    if not user_id:
        return
    try:
        sb.auth.admin.delete_user(user_id)
        logger.info("Rollback: Supabase user deleted", user_id=user_id)
    except Exception as exc:
        logger.error("Rollback: failed to delete Supabase user", user_id=user_id, error=str(exc))


def _rollback_db_client(sb: Any, client_id: str | None) -> None:
    """Delete the clients DB row during rollback (best-effort)."""
    if not client_id:
        return
    try:
        sb.table("clients").delete().eq("id", client_id).execute()
        logger.info("Rollback: DB client record deleted", client_id=client_id)
    except Exception as exc:
        logger.error("Rollback: failed to delete DB client", client_id=client_id, error=str(exc))


def _rollback_vapi_assistant(assistant_id: str | None) -> None:
    """Delete Vapi assistant during rollback (best-effort, fire-and-forget)."""
    if not assistant_id:
        return
    import asyncio
    try:
        from backend.services.vapi_service import delete_assistant
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # We're already in an async context — schedule and don't await
            # (rollback is best-effort; we already raised HTTPException).
            loop.create_task(delete_assistant(assistant_id))
        else:
            loop.run_until_complete(delete_assistant(assistant_id))
        logger.info("Rollback: Vapi assistant delete initiated", assistant_id=assistant_id)
    except Exception as exc:
        logger.error("Rollback: failed to delete Vapi assistant", assistant_id=assistant_id, error=str(exc))
