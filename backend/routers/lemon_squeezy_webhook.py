"""
LemonSqueezy webhook handler.

Receives subscription lifecycle events from LemonSqueezy and updates the
client's subscription_status in the DB so the admin panel can show payment
status per client.

Signature verification: LemonSqueezy signs each webhook with HMAC-SHA256
using the LEMON_SQUEEZY_WEBHOOK_SECRET. We verify this before processing.

Events handled:
  subscription_created     → status='active', store IDs + renews_at
  subscription_updated     → update status + renews_at
  subscription_cancelled   → status='cancelled'
  subscription_paused      → status='paused'
  subscription_expired     → status='expired'
  subscription_payment_failed  → status='past_due'
  order_created            → informational only (log)

Unrecognised events are logged as warnings and return 200 (LemonSqueezy
requires a 200 for all events, even ones we don't handle).
"""
from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.db.client import get_supabase
from backend.utils.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()

# Map LemonSqueezy event names to our subscription_status values.
_EVENT_TO_STATUS: dict[str, str] = {
    "subscription_created": "active",
    "subscription_updated": None,   # status read from payload
    "subscription_cancelled": "cancelled",
    "subscription_paused": "paused",
    "subscription_expired": "expired",
    "subscription_payment_failed": "past_due",
    "subscription_payment_success": "active",
    "subscription_payment_recovered": "active",
    "subscription_plan_changed": None,  # status read from payload
}

# LemonSqueezy status values → our DB status values.
_LS_STATUS_MAP: dict[str, str] = {
    "active": "active",
    "cancelled": "cancelled",
    "paused": "paused",
    "past_due": "past_due",
    "expired": "expired",
    "unpaid": "past_due",
    "on_trial": "active",
}


def _verify_signature(body: bytes, signature_header: str | None) -> bool:
    """Return True if the HMAC-SHA256 signature matches the request body.

    LemonSqueezy sends the signature in the 'X-Signature' header as a
    hex-encoded HMAC-SHA256 digest of the raw request body.
    """
    secret = settings.lemon_squeezy_webhook_secret
    if not secret:
        # Webhook secret not configured — skip verification in development.
        logger.warning("LEMON_SQUEEZY_WEBHOOK_SECRET not set; skipping signature verification")
        return True
    if not signature_header:
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


@router.post("/webhook/lemon-squeezy")
async def lemon_squeezy_webhook(request: Request) -> JSONResponse:
    """Handle LemonSqueezy subscription lifecycle events.

    Always returns 200 so LemonSqueezy does not retry unnecessarily.
    Internal errors are logged but do not affect the response status.
    """
    body = await request.body()
    signature = request.headers.get("X-Signature")

    if not _verify_signature(body, signature):
        logger.warning("LemonSqueezy webhook: invalid signature")
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload: dict[str, Any] = await request.json()
    except Exception as exc:
        logger.error("LemonSqueezy webhook: failed to parse JSON", error=str(exc))
        return JSONResponse({"ok": False, "error": "invalid json"}, status_code=200)

    meta: dict = payload.get("meta", {})
    event_name: str = meta.get("event_name", "")
    data: dict = payload.get("data", {})
    attributes: dict = data.get("attributes", {})

    logger.info("LemonSqueezy event received", ls_ls_event=event_name)

    if event_name == "order_created":
        # Informational — first purchase. No subscription yet.
        logger.info("LemonSqueezy order created", order_id=data.get("id"))
        return JSONResponse({"ok": True})

    if event_name not in _EVENT_TO_STATUS:
        logger.warning("LemonSqueezy: unhandled event", ls_event=event_name)
        return JSONResponse({"ok": True})

    # Extract key fields from the event payload.
    customer_email: str = attributes.get("user_email", "")
    ls_customer_id: str = str(attributes.get("customer_id", ""))
    ls_subscription_id: str = str(data.get("id", ""))
    renews_at_raw: str | None = attributes.get("renews_at")

    # Determine the new status.
    fixed_status = _EVENT_TO_STATUS[event_name]
    if fixed_status is None:
        # Read status from payload (e.g. subscription_updated).
        ls_status = attributes.get("status", "")
        new_status = _LS_STATUS_MAP.get(ls_status, "none")
    else:
        new_status = fixed_status

    if not customer_email:
        logger.warning("LemonSqueezy webhook: no customer email in payload", ls_event=event_name)
        return JSONResponse({"ok": True})

    await _update_client_subscription(
        email=customer_email,
        ls_customer_id=ls_customer_id,
        ls_subscription_id=ls_subscription_id,
        new_status=new_status,
        renews_at_raw=renews_at_raw,
        event_name=event_name,
    )
    return JSONResponse({"ok": True})


async def _update_client_subscription(
    email: str,
    ls_customer_id: str,
    ls_subscription_id: str,
    new_status: str,
    renews_at_raw: str | None,
    event_name: str,
) -> None:
    """Find client by email and update subscription fields in DB."""
    sb = get_supabase()

    try:
        resp = sb.table("clients").select("id").eq("email", email).limit(1).execute()
        rows: list[dict] = resp.data or []
    except Exception as exc:
        logger.error("LemonSqueezy: client lookup failed", email=email, error=str(exc))
        return

    if not rows:
        logger.warning("LemonSqueezy: no client found for email", email=email, ls_event=event_name)
        return

    client_id = rows[0]["id"]

    update: dict[str, Any] = {
        "subscription_status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if ls_customer_id:
        update["lemon_squeezy_customer_id"] = ls_customer_id
    if ls_subscription_id:
        update["lemon_squeezy_subscription_id"] = ls_subscription_id
    if renews_at_raw:
        update["subscription_renews_at"] = renews_at_raw

    try:
        sb.table("clients").update(update).eq("id", client_id).execute()
        logger.info(
            "LemonSqueezy: subscription updated",
            client_id=client_id,
            ls_ls_event=event_name,
            new_status=new_status,
        )
    except Exception as exc:
        logger.error(
            "LemonSqueezy: DB update failed",
            client_id=client_id,
            ls_ls_event=event_name,
            error=str(exc),
        )
