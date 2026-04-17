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
    send_sms,
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
            # Auto-reply: callers sometimes text back to confirm or ask questions.
            # Look up business name for a personalised response; fall back gracefully.
            business_name = "our team"
            main_phone = ""
            if client_id:
                try:
                    sb = get_supabase()
                    biz_res = (
                        sb.table("clients")
                        .select("business_name, main_phone_number")
                        .eq("id", client_id)
                        .limit(1)
                        .execute()
                    )
                    if biz_res.data:
                        business_name = biz_res.data[0].get("business_name") or business_name
                        main_phone = biz_res.data[0].get("main_phone_number") or ""
                except Exception as exc:
                    logger.warning("Auto-reply biz lookup failed", error=str(exc))

            if main_phone:
                auto_reply = (
                    f"Hi! This is an automated number for {business_name}. "
                    f"For live assistance please call us at {main_phone}. "
                    f"Reply STOP to opt out of texts."
                )
            else:
                auto_reply = (
                    f"Hi! This is an automated number for {business_name}. "
                    f"We can't read replies here — please call us to speak with our team. "
                    f"Reply STOP to opt out of texts."
                )
            send_sms(from_number, auto_reply, client_id)

    except Exception as exc:
        logger.error("Inbound SMS handler error", error=str(exc))

    return Response(content=_TWIML_EMPTY, media_type="application/xml")
