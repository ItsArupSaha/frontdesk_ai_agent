"""Reminder and notification queue service.

All functions are best-effort — they never raise. Failures are logged so the
caller experience is never blocked by a queuing error.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from backend.utils.logging import get_logger
from backend.utils.message_builders import (
    booking_reminder_sms,
    callback_request_message,
    missed_call_recovery_sms,
)

logger = get_logger(__name__)


def queue_booking_reminder(
    client_id: str,
    caller_phone: str,
    business_name: str,
    appointment_label: str,
    caller_address: str,
    appointment_start: str,
    supabase: Any = None,
) -> None:
    """Queue a 24h pre-appointment reminder SMS."""
    from backend.db.client import get_supabase
    sb = supabase or get_supabase()
    try:
        appt_start_dt = datetime.fromisoformat(appointment_start)
        reminder_at = appt_start_dt - timedelta(hours=24)
        msg = booking_reminder_sms(business_name, appointment_label, caller_address)
        sb.table("reminders_queue").insert([{
            "client_id": client_id,
            "type": "reminder",
            "to_number": caller_phone,
            "scheduled_for": reminder_at.isoformat(),
            "message_body": msg,
        }]).execute()
        logger.info("Reminder queued after booking", client_id=client_id)
    except Exception as exc:
        logger.error("Failed to queue booking reminder", client_id=client_id, error=str(exc))


def queue_callback_request(
    client_id: str,
    caller_name: str | None,
    caller_phone: str,
    reason: str,
    supabase: Any = None,
) -> None:
    """Queue a callback request so the admin is notified."""
    if not client_id or not caller_phone:
        return
    from backend.db.client import get_supabase
    sb = supabase or get_supabase()
    try:
        msg = callback_request_message(caller_name, caller_phone, reason)
        sb.table("reminders_queue").insert({
            "client_id": client_id,
            "type": "callback_request",
            "to_number": caller_phone,
            "scheduled_for": datetime.now(timezone.utc).isoformat(),
            "message_body": msg,
        }).execute()
        logger.info("Callback request recorded", client_id=client_id, phone=caller_phone)
    except Exception as exc:
        logger.error("Failed to record callback request", client_id=client_id, error=str(exc))


def queue_missed_call_recovery(
    client_id: str,
    to_number: str,
    business_name: str,
    calling_number: str | None = None,
    supabase: Any = None,
) -> None:
    """Queue a missed-call recovery SMS (2-minute delay)."""
    from backend.db.client import get_supabase
    sb = supabase or get_supabase()
    try:
        scheduled_for = (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat()
        msg = missed_call_recovery_sms(business_name, calling_number)
        sb.table("reminders_queue").insert({
            "client_id": client_id,
            "type": "missed_call_recovery",
            "to_number": to_number,
            "scheduled_for": scheduled_for,
            "message_body": msg,
        }).execute()
        logger.info("Missed-call recovery queued", client_id=client_id)
    except Exception as exc:
        logger.error("Failed to queue missed-call recovery", client_id=client_id, error=str(exc))
