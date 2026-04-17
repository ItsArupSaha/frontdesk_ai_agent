"""
Inbound SMS webhook — handles Twilio inbound messages.

Twilio POSTs form-encoded data to this endpoint whenever a caller replies
to any of our SMS messages.  We process STOP/START for TCPA compliance and
ignore everything else.

Configure in Twilio: Phone Numbers → your number → Messaging → A MESSAGE COMES IN
→ Webhook → POST https://your-domain/webhook/sms/inbound
"""
from fastapi import APIRouter, Request
from fastapi.responses import Response

from backend.db.client import get_supabase
from backend.services.sms_service import (
    _STOP_KEYWORDS,
    _START_KEYWORDS,
    record_optout,
    remove_optout,
)
from backend.utils.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()

_TWIML_EMPTY = '<?xml version="1.0"?><Response></Response>'


@router.post("/sms/inbound")
async def inbound_sms(request: Request) -> Response:
    """Process inbound SMS from Twilio.

    Handles STOP (opt-out) and START/UNSTOP (opt-in) keywords.
    Returns an empty TwiML response — Twilio itself handles the mandatory
    STOP confirmation reply per carrier requirements.
    """
    try:
        form = await request.form()
        body: str = (form.get("Body") or "").strip().upper()
        from_number: str = form.get("From") or ""
        to_number: str = form.get("To") or ""  # our Twilio number → find client

        if not from_number:
            return Response(content=_TWIML_EMPTY, media_type="application/xml")

        # Resolve which client owns this Twilio number.
        client_id: str = ""
        try:
            sb = get_supabase()
            res = (
                sb.table("clients")
                .select("id")
                .eq("twilio_phone_number", to_number)
                .limit(1)
                .execute()
            )
            if res.data:
                client_id = str(res.data[0]["id"])
        except Exception as exc:
            logger.warning("Client lookup failed for inbound SMS", to=to_number, error=str(exc))

        if body in _STOP_KEYWORDS:
            record_optout(from_number, client_id)
            logger.info("STOP received", from_number=from_number, client_id=client_id)
        elif body in _START_KEYWORDS:
            remove_optout(from_number, client_id)
            logger.info("START received", from_number=from_number, client_id=client_id)
        else:
            logger.info(
                "Inbound SMS (no action)",
                from_number=from_number,
                client_id=client_id,
                body_preview=body[:40],
            )

    except Exception as exc:
        logger.error("Inbound SMS handler error", error=str(exc))

    return Response(content=_TWIML_EMPTY, media_type="application/xml")
