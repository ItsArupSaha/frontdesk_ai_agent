"""
Twilio SMS service for sending booking confirmations and missed-call recovery.
SMS failures NEVER raise — they log and return a failure dict so the caller
experience is unaffected even if Twilio is down.
"""
import re

import structlog
from twilio.rest import Client as TwilioClient

from backend.config import settings

logger = structlog.get_logger(__name__)

_E164_RE = re.compile(r"^\+[1-9]\d{1,14}$")

# TCPA STOP keywords (per Twilio compliance guidelines)
_STOP_KEYWORDS = {"STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"}
_START_KEYWORDS = {"START", "YES", "UNSTOP"}


def _is_valid_e164(number: str) -> bool:
    """Return True if number is a valid E.164 phone number."""
    return bool(_E164_RE.match(number))


def is_opted_out(phone_number: str, client_id: str) -> bool:
    """Return True if this number has sent STOP for this client."""
    try:
        from backend.db.client import get_supabase
        sb = get_supabase()
        res = (
            sb.table("sms_optouts")
            .select("id")
            .eq("phone_number", phone_number)
            .eq("client_id", client_id)
            .limit(1)
            .execute()
        )
        return bool(res.data)
    except Exception as exc:
        logger.warning("Optout check failed — assuming not opted out", error=str(exc))
        return False


def record_optout(phone_number: str, client_id: str) -> None:
    """Record a STOP request for TCPA compliance."""
    try:
        from backend.db.client import get_supabase
        get_supabase().table("sms_optouts").upsert(
            {"phone_number": phone_number, "client_id": client_id},
            on_conflict="phone_number,client_id",
            ignore_duplicates=True,
        ).execute()
        logger.info("SMS optout recorded", phone=phone_number, client_id=client_id)
    except Exception as exc:
        logger.error("Failed to record SMS optout", error=str(exc))


def remove_optout(phone_number: str, client_id: str) -> None:
    """Remove a STOP record when a caller sends START/UNSTOP."""
    try:
        from backend.db.client import get_supabase
        get_supabase().table("sms_optouts").delete().eq(
            "phone_number", phone_number
        ).eq("client_id", client_id).execute()
        logger.info("SMS optout removed", phone=phone_number, client_id=client_id)
    except Exception as exc:
        logger.error("Failed to remove SMS optout", error=str(exc))


def send_sms(to_number: str, message: str, client_id: str) -> dict:
    """Send an SMS via Twilio.

    Args:
        to_number: Destination phone number in E.164 format (+1xxxxxxxxxx).
        message: SMS body text.
        client_id: Internal client UUID (for logging context).

    Returns:
        {'success': True, 'sid': str} on success.
        {'success': False, 'error': str} on any failure — never raises.
    """
    if not _is_valid_e164(to_number):
        logger.warning(
            "Invalid phone number for SMS — skipping",
            to=to_number,
            client_id=client_id,
        )
        return {"success": False, "error": f"Invalid E.164 number: {to_number}"}

    if is_opted_out(to_number, client_id):
        logger.info("SMS suppressed — number opted out", to=to_number, client_id=client_id)
        return {"success": False, "error": "opted_out"}

    try:
        twilio = TwilioClient(settings.twilio_account_sid, settings.twilio_auth_token)
        msg = twilio.messages.create(
            body=message,
            from_=settings.twilio_from_number,
            to=to_number,
        )
        logger.info("SMS sent", sid=msg.sid, to=to_number, client_id=client_id)
        return {"success": True, "sid": msg.sid}
    except Exception as exc:
        logger.error(
            "SMS send failed",
            to=to_number,
            client_id=client_id,
            error=str(exc),
        )
        return {"success": False, "error": str(exc)}


def send_booking_confirmation(booking_details: dict, client_config: dict) -> dict:
    """Send an appointment confirmation SMS to the caller.

    Args:
        booking_details: Dict with caller_name, caller_phone, appointment_label, business_name.
        client_config: Client configuration dict (used for client_id logging).

    Returns:
        Result dict from send_sms.
    """
    caller_name = booking_details.get("caller_name", "there")
    caller_phone = booking_details.get("caller_phone", "")
    appointment_label = booking_details.get("appointment_label", "your appointment")
    business_name = booking_details.get("business_name", "us")
    client_id = client_config.get("id", "unknown")

    message = (
        f"Hi {caller_name}! Your appointment with {business_name} is confirmed "
        f"for {appointment_label}. We'll see you then! Reply STOP to opt out."
    )

    return send_sms(caller_phone, message, client_id)


def send_missed_call_recovery(
    caller_number: str,
    business_name: str,
    client_id: str,
) -> dict:
    """Send a missed-call recovery SMS to a caller who hung up without booking.

    Args:
        caller_number: Caller's phone number in E.164 format.
        business_name: Display name of the client business.
        client_id: Internal client UUID.

    Returns:
        Result dict from send_sms.
    """
    message = (
        f"Hi! We missed your call at {business_name}. Still need help? "
        f"Reply here and we'll get back to you shortly."
    )
    return send_sms(caller_number, message, client_id)
