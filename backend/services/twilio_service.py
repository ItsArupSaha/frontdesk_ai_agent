"""
Twilio phone number provisioning service.

Handles searching for, purchasing, and releasing Twilio phone numbers
for new clients. Each client gets their own dedicated phone number on
Arup's central Twilio account.

Fallback strategy when no local numbers are available in the requested
area code:
  1. Try neighbour area codes (per FALLBACK_AREA_CODES mapping).
  2. Purchase a toll-free number.

All functions raise TwilioProvisionError on unrecoverable failure so
onboarding callers can roll back cleanly.
"""
from __future__ import annotations

from backend.config import settings
from backend.utils.logging import get_logger

logger = get_logger(__name__)

# Neighbour area codes to try when the requested area code has no inventory.
FALLBACK_AREA_CODES: dict[str, list[str]] = {
    "718": ["917", "212", "646"],   # NYC outer boroughs
    "212": ["646", "917", "718"],   # Manhattan
    "213": ["310", "323", "424"],   # LA
    "310": ["424", "213", "323"],   # West LA
    "312": ["872", "773"],          # Chicago
    "415": ["628", "510", "408"],   # San Francisco
    "617": ["857", "781"],          # Boston
    "713": ["832", "281"],          # Houston
    "404": ["678", "770"],          # Atlanta
    "305": ["786", "954"],          # Miami
}


class TwilioProvisionError(Exception):
    """Raised when no phone number can be provisioned after all fallbacks."""


def _get_client():
    """Return an authenticated Twilio Client.

    Lazy import so tests that don't set Twilio credentials don't fail on import.
    """
    from twilio.rest import Client  # type: ignore[import]
    return Client(settings.twilio_account_sid, settings.twilio_auth_token)


async def provision_number(area_code: str, client_id: str) -> str:
    """Search for and purchase a Twilio phone number for a client.

    Attempts in order:
    1. Local number in ``area_code``.
    2. Local numbers in fallback area codes (per FALLBACK_AREA_CODES).
    3. Any toll-free number.

    The purchased number's SMS URL is configured to point at our Twilio
    SMS webhook, and its friendly name includes the client_id for tracking.

    Args:
        area_code: 3-digit US area code (e.g. "718").
        client_id: Internal client UUID for naming and logging.

    Returns:
        Purchased phone number in E.164 format (e.g. "+17185551234").

    Raises:
        TwilioProvisionError: if no number can be provisioned after all fallbacks.
    """
    import asyncio
    loop = asyncio.get_event_loop()
    sms_url = f"{settings.base_url}/webhook/twilio/sms"

    def _search_local(ac: str) -> list:
        """Synchronous Twilio local number search (run in executor)."""
        try:
            twilio = _get_client()
            return twilio.available_phone_numbers("US").local.list(
                area_code=ac,
                sms_enabled=True,
                limit=5,
            )
        except Exception as exc:
            logger.warning("Twilio local search failed", area_code=ac, error=str(exc))
            return []

    def _search_toll_free() -> list:
        """Synchronous Twilio toll-free number search (run in executor)."""
        try:
            twilio = _get_client()
            return twilio.available_phone_numbers("US").toll_free.list(
                sms_enabled=True,
                limit=1,
            )
        except Exception as exc:
            logger.warning("Twilio toll-free search failed", error=str(exc))
            return []

    def _purchase(phone_number_str: str) -> str:
        """Purchase a number and configure its webhook. Returns E.164 number."""
        twilio = _get_client()
        purchased = twilio.incoming_phone_numbers.create(
            phone_number=phone_number_str,
            sms_url=sms_url,
            friendly_name=f"Client {client_id}",
        )
        return purchased.phone_number

    # Step 1: Requested area code.
    candidates = await loop.run_in_executor(None, _search_local, area_code)

    # Step 2: Fallback area codes.
    if not candidates:
        logger.info("No local numbers in area code, trying fallbacks", area_code=area_code)
        for fallback_ac in FALLBACK_AREA_CODES.get(area_code, []):
            candidates = await loop.run_in_executor(None, _search_local, fallback_ac)
            if candidates:
                logger.info("Found numbers in fallback area code", fallback_area_code=fallback_ac)
                break

    # Step 3: Toll-free.
    if not candidates:
        logger.info("No local numbers found, trying toll-free")
        candidates = await loop.run_in_executor(None, _search_toll_free)

    if not candidates:
        raise TwilioProvisionError(
            f"No phone numbers available for area code {area_code} or any fallbacks"
        )

    phone_number_str: str = candidates[0].phone_number

    try:
        purchased_number = await loop.run_in_executor(None, _purchase, phone_number_str)
    except Exception as exc:
        logger.error(
            "Twilio number purchase failed",
            client_id=client_id,
            phone_number=phone_number_str,
            error=str(exc),
        )
        raise TwilioProvisionError(f"Failed to purchase number {phone_number_str}: {exc}") from exc

    logger.info("Twilio number provisioned", client_id=client_id, phone_number=purchased_number)
    return purchased_number


async def release_number(phone_number: str) -> None:
    """Release a Twilio phone number (used during onboarding rollback).

    Finds the number SID by phone number string, then deletes it.
    Errors are logged and re-raised so callers know rollback failed.

    Args:
        phone_number: E.164 phone number to release (e.g. "+17185551234").

    Raises:
        TwilioProvisionError: if the number cannot be found or released.
    """
    import asyncio
    loop = asyncio.get_event_loop()

    def _do_release() -> None:
        twilio = _get_client()
        # List incoming numbers filtered by phone number to get the SID.
        numbers = twilio.incoming_phone_numbers.list(
            phone_number=phone_number,
            limit=1,
        )
        if not numbers:
            logger.warning("Twilio release: number not found", phone_number=phone_number)
            return
        numbers[0].delete()
        logger.info("Twilio number released", phone_number=phone_number)

    try:
        await loop.run_in_executor(None, _do_release)
    except Exception as exc:
        logger.error("Twilio release failed", phone_number=phone_number, error=str(exc))
        raise TwilioProvisionError(f"Failed to release {phone_number}: {exc}") from exc
