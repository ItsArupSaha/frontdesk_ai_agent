"""Client activation provisioning service — 7-step workflow.

Both the SSE streaming endpoint and the legacy synchronous endpoint delegate
to ``run_activation``.  The caller supplies an optional ``on_step`` callback
to receive progress events; the SSE endpoint formats them as server-sent
events, the synchronous endpoint ignores them.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable

from backend.config import settings
from backend.utils.logging import get_logger

logger = get_logger(__name__)


class ActivationError(Exception):
    """Raised when a critical provisioning step fails."""

    def __init__(self, message: str, step: str) -> None:
        super().__init__(message)
        self.step = step


async def run_activation(
    client_id: str,
    client: dict,
    sb: Any,
    on_step: Callable[[str, str, str], None] | None = None,
) -> dict:
    """Run the 7-step client activation workflow.

    Args:
        client_id: Client UUID.
        client: Client DB row dict.
        sb: Supabase client instance.
        on_step: Optional callback(step_name, status, message) for progress.
            status is one of: 'running' | 'done' | 'skipped'.

    Returns:
        Dict with client_id, vapi_phone_number, twilio_phone_number, email,
        business_name.

    Raises:
        ActivationError: If any critical step fails (after rollback where possible).
    """

    def _progress(step: str, status: str, message: str) -> None:
        if on_step:
            on_step(step, status, message)

    email = client["email"]
    business_name = client.get("business_name", "")
    client_config = {
        "business_name": business_name,
        "emergency_phone_number": client.get("emergency_phone_number", ""),
        "services_offered": client.get("services_offered") or [],
        "working_hours": client.get("working_hours") or {},
        "service_area_description": client.get("service_area_description", ""),
    }
    emergency_phone = client.get("emergency_phone_number", "+12120000000")
    area_code = emergency_phone[2:5] if len(emergency_phone) >= 5 else "212"

    from backend.routers.onboarding import (
        _generate_temp_password,
        _rollback_supabase_user,
        _rollback_vapi_assistant,
    )
    import httpx as _httpx

    vapi_assistant_id: str | None = None
    vapi_phone_number: str | None = None
    _supabase_user_existed = False
    _assistant_valid = False

    # -----------------------------------------------------------------------
    # Step 1: Supabase auth user — skip if already exists (retry-safe).
    # -----------------------------------------------------------------------
    _progress("auth", "running", "Creating client account…")
    try:
        existing_user = sb.auth.admin.get_user_by_id(client_id)
        if existing_user and existing_user.user:
            _supabase_user_existed = True
    except Exception:
        pass

    if not _supabase_user_existed:
        try:
            cr = sb.auth.admin.create_user({
                "id": client_id,
                "email": email,
                "email_confirm": True,
                "password": _generate_temp_password(),
            })
            if not cr or not cr.user:
                raise RuntimeError("No user returned")
        except Exception as exc:
            raise ActivationError(f"Failed to create auth account: {exc}", "auth")

    _progress("auth", "done", f"✓ Auth account ready ({email})")

    # -----------------------------------------------------------------------
    # Step 2: Vapi assistant — reuse if DB already has a valid one.
    # -----------------------------------------------------------------------
    _progress("assistant", "running", "Creating AI assistant…")
    _existing_aid: str | None = client.get("vapi_assistant_id")
    if _existing_aid:
        try:
            async with _httpx.AsyncClient(timeout=10) as _hc:
                _r = await _hc.get(
                    f"https://api.vapi.ai/assistant/{_existing_aid}",
                    headers={"Authorization": f"Bearer {settings.vapi_api_key}"},
                )
            if _r.status_code == 200:
                _assistant_valid = True
                vapi_assistant_id = _existing_aid
        except Exception:
            pass

    if not _assistant_valid:
        try:
            from backend.services.vapi_service import create_assistant
            vapi_assistant_id = await create_assistant(client_config, client_id)
            sb.table("clients").update(
                {"vapi_assistant_id": vapi_assistant_id}
            ).eq("id", client_id).execute()
        except Exception as exc:
            if not _supabase_user_existed:
                _rollback_supabase_user(sb, client_id)
            raise ActivationError(f"Failed to create AI assistant: {exc}", "assistant")

    _progress("assistant", "done", f"✓ AI assistant created (ID: {vapi_assistant_id})")

    # -----------------------------------------------------------------------
    # Step 3: Vapi phone number — reuse if DB already has a valid one.
    # -----------------------------------------------------------------------
    _progress(
        "phone", "running",
        f"Purchasing phone number (area code {area_code})… this may take 15–30 s",
    )
    _existing_phone: str | None = client.get("vapi_phone_number")
    _phone_valid = False
    if _existing_phone:
        try:
            async with _httpx.AsyncClient(timeout=10) as _hc:
                _r = await _hc.get(
                    "https://api.vapi.ai/phone-number",
                    headers={"Authorization": f"Bearer {settings.vapi_api_key}"},
                )
            if _r.status_code == 200 and _existing_phone in {n.get("number") for n in _r.json()}:
                _phone_valid = True
                vapi_phone_number = _existing_phone
            else:
                sb.table("clients").update(
                    {"vapi_phone_number": None}
                ).eq("id", client_id).execute()
        except Exception:
            pass

    if not _phone_valid:
        try:
            from backend.services.vapi_service import buy_phone_number
            _, vapi_phone_number = await buy_phone_number(
                area_code=area_code,
                assistant_id=vapi_assistant_id,
                client_id=client_id,
                business_name=business_name,
            )
            sb.table("clients").update(
                {"vapi_phone_number": vapi_phone_number}
            ).eq("id", client_id).execute()
        except Exception as exc:
            if not _assistant_valid:
                _rollback_vapi_assistant(vapi_assistant_id)
                try:
                    sb.table("clients").update(
                        {"vapi_assistant_id": None}
                    ).eq("id", client_id).execute()
                except Exception:
                    pass
            if not _supabase_user_existed:
                _rollback_supabase_user(sb, client_id)
            raise ActivationError(f"Failed to purchase phone number: {exc}", "phone")

    _progress("phone", "done", f"✓ AI calling number assigned: {vapi_phone_number}")

    # -----------------------------------------------------------------------
    # Step 4: Twilio SMS number — non-fatal (A2P registration required).
    # -----------------------------------------------------------------------
    _progress("twilio", "running", "Provisioning SMS number…")
    twilio_phone_number: str | None = None
    try:
        from backend.services.twilio_service import provision_number
        twilio_phone_number = await provision_number(area_code, client_id)
        sb.table("clients").update(
            {"twilio_phone_number": twilio_phone_number}
        ).eq("id", client_id).execute()
        _progress("twilio", "done", f"✓ SMS number provisioned: {twilio_phone_number}")
    except Exception:
        _progress(
            "twilio", "skipped",
            "⚠ SMS number skipped (A2P registration required) — enable after carrier approval",
        )

    # -----------------------------------------------------------------------
    # Step 5: Mark client active.
    # -----------------------------------------------------------------------
    _progress("activate", "running", "Finalising activation…")
    try:
        sb.table("clients").update({
            "onboarding_status": "active",
            "is_active": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", client_id).execute()
    except Exception as exc:
        raise ActivationError(f"Status update failed: {exc}", "activate")

    _progress("activate", "done", "✓ Client marked active")

    # -----------------------------------------------------------------------
    # Step 6: Ingest knowledge base — non-fatal.
    # -----------------------------------------------------------------------
    _progress("kb", "running", "Ingesting knowledge base…")
    try:
        from backend.services.rag_service import ingest_client_knowledge
        await ingest_client_knowledge(client_id, client_config)
        _progress("kb", "done", "✓ Knowledge base ingested")
    except Exception:
        _progress("kb", "skipped", "⚠ KB ingest skipped (non-critical)")

    logger.info("Client activated", client_id=client_id, phone=vapi_phone_number)
    return {
        "client_id": client_id,
        "vapi_phone_number": vapi_phone_number,
        "twilio_phone_number": twilio_phone_number,
        "email": email,
        "business_name": business_name,
    }
