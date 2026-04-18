"""
Vapi assistant management service.

Handles creation, update, and deletion of Vapi AI phone assistants
via the Vapi REST API. One assistant is provisioned per client on
Arup's central Vapi account.

All functions raise VapiServiceError on API errors so callers can
roll back any partial state.
"""
from __future__ import annotations

import httpx
from backend.config import settings
from backend.utils.logging import get_logger

logger = get_logger(__name__)

_VAPI_BASE = "https://api.vapi.ai"
_DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # Rachel — ElevenLabs


class VapiServiceError(Exception):
    """Raised when the Vapi API returns an error or an unexpected response."""


def _headers() -> dict[str, str]:
    """Return Vapi authorization headers."""
    return {
        "Authorization": f"Bearer {settings.vapi_api_key}",
        "Content-Type": "application/json",
    }


def _system_prompt(business_name: str, services: list[str], working_hours: dict) -> str:
    """Build the system prompt for a new Vapi assistant.

    Args:
        business_name: Client's business name.
        services: List of services the business offers.
        working_hours: Dict of day → hours string.

    Returns:
        Formatted system prompt string.
    """
    services_str = ", ".join(services) if services else "home services"
    hours_lines = "\n".join(
        f"  {day}: {hrs}" for day, hrs in working_hours.items()
    ) if working_hours else "  Mon-Fri: 8am-6pm"

    return (
        f"You are Alex, the AI assistant for {business_name}. "
        f"You answer inbound calls 24/7 for a {services_str} business.\n\n"
        f"Your job:\n"
        f"1. Greet callers warmly and find out how you can help.\n"
        f"2. Detect emergencies (burst pipes, gas leaks, sparking wires, no heat) "
        f"and escalate immediately.\n"
        f"3. Qualify the lead — get name, address, problem description.\n"
        f"4. Book appointments during working hours:\n{hours_lines}\n"
        f"5. Send SMS confirmation once booked.\n\n"
        f"Always be professional, empathetic, and efficient. "
        f"If you can't help, offer to connect them with a human."
    )


async def create_assistant(client_config: dict, client_id: str) -> str:
    """Create a new Vapi assistant for a client and return its assistant_id.

    Posts to POST /assistant with the client's business name, services,
    working hours, and our webhook URL. The assistant uses the ElevenLabs
    Rachel voice and GPT-4o for reasoning.

    Args:
        client_config: Dict with keys: business_name, services_offered,
                       working_hours, emergency_phone_number.
        client_id: Internal client UUID (used for logging).

    Returns:
        Vapi assistant ID string.

    Raises:
        VapiServiceError: on any API error.
    """
    business_name: str = client_config.get("business_name", "Our Business")
    services: list[str] = client_config.get("services_offered", [])
    working_hours: dict = client_config.get("working_hours", {})

    webhook_url = f"{settings.vapi_webhook_base_url}/webhook/vapi"

    payload = {
        "name": f"{business_name} Agent",
        "model": {
            "provider": "openai",
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "system",
                    "content": _system_prompt(business_name, services, working_hours),
                }
            ],
        },
        "voice": {
            "provider": "11labs",
            "voiceId": _DEFAULT_VOICE_ID,
        },
        "firstMessage": (
            f"Thanks for calling {business_name}, this is Alex! "
            f"How can I help you today?"
        ),
        "serverUrl": webhook_url,
        "serverUrlSecret": settings.vapi_webhook_secret,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(
                f"{_VAPI_BASE}/assistant",
                headers=_headers(),
                json=payload,
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Vapi create_assistant failed",
                client_id=client_id,
                status=exc.response.status_code,
                body=exc.response.text[:500],
            )
            raise VapiServiceError(
                f"Vapi API error {exc.response.status_code}: {exc.response.text[:200]}"
            ) from exc
        except httpx.RequestError as exc:
            logger.error("Vapi create_assistant network error", client_id=client_id, error=str(exc))
            raise VapiServiceError(f"Vapi network error: {exc}") from exc

    data = resp.json()
    assistant_id: str | None = data.get("id")
    if not assistant_id:
        raise VapiServiceError(f"Vapi response missing 'id': {data}")

    logger.info("Vapi assistant created", client_id=client_id, assistant_id=assistant_id)
    return assistant_id


async def update_assistant(assistant_id: str, client_config: dict) -> None:
    """Update an existing Vapi assistant's greeting and webhook URL.

    Called from the Settings save flow when business_name or webhook URL changes.

    Args:
        assistant_id: Existing Vapi assistant ID.
        client_config: Dict with updated fields (business_name, etc.).

    Raises:
        VapiServiceError: on any API error.
    """
    business_name: str = client_config.get("business_name", "Our Business")
    webhook_url = f"{settings.vapi_webhook_base_url}/webhook/vapi"

    patch_payload: dict = {
        "name": f"{business_name} Agent",
        "firstMessage": (
            f"Thanks for calling {business_name}, this is Alex! "
            f"How can I help you today?"
        ),
        "serverUrl": webhook_url,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.patch(
                f"{_VAPI_BASE}/assistant/{assistant_id}",
                headers=_headers(),
                json=patch_payload,
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Vapi update_assistant failed",
                assistant_id=assistant_id,
                status=exc.response.status_code,
            )
            raise VapiServiceError(
                f"Vapi API error {exc.response.status_code}: {exc.response.text[:200]}"
            ) from exc
        except httpx.RequestError as exc:
            logger.error("Vapi update_assistant network error", assistant_id=assistant_id, error=str(exc))
            raise VapiServiceError(f"Vapi network error: {exc}") from exc

    logger.info("Vapi assistant updated", assistant_id=assistant_id)


async def delete_assistant(assistant_id: str) -> None:
    """Delete a Vapi assistant by ID.

    Called during onboarding rollback if a later step fails. Errors are
    logged but not re-raised — a dangling Vapi assistant is not critical.

    Args:
        assistant_id: Vapi assistant ID to delete.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.delete(
                f"{_VAPI_BASE}/assistant/{assistant_id}",
                headers=_headers(),
            )
            resp.raise_for_status()
            logger.info("Vapi assistant deleted", assistant_id=assistant_id)
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Vapi delete_assistant failed",
                assistant_id=assistant_id,
                status=exc.response.status_code,
            )
            raise VapiServiceError(
                f"Vapi delete error {exc.response.status_code}: {exc.response.text[:200]}"
            ) from exc
        except httpx.RequestError as exc:
            logger.error("Vapi delete_assistant network error", assistant_id=assistant_id, error=str(exc))
            raise VapiServiceError(f"Vapi network error: {exc}") from exc


async def buy_phone_number(
    area_code: str,
    assistant_id: str,
    client_id: str,
    business_name: str,
) -> tuple[str, str]:
    """Buy a Vapi-native phone number and link it to an assistant.

    Vapi manages the number end-to-end (telephony, inbound routing, STT/TTS).
    No Twilio credentials needed here — Twilio is used separately for SMS only.

    Tries the requested area code first. If Vapi has no inventory there,
    falls back to buying any available US number.

    Args:
        area_code: 3-digit US area code (e.g. "216").
        assistant_id: Vapi assistant ID to link to this number.
        client_id: Internal client UUID (for logging).
        business_name: Used as the Vapi phone label.

    Returns:
        Tuple of (vapi_phone_id, phone_number_e164).
        Store vapi_phone_id for rollback via delete_phone_number().

    Raises:
        VapiServiceError: on any API error or no number available.
    """
    async with httpx.AsyncClient(timeout=30) as http:
        # Try requested area code first.
        for attempt_payload in [
            {
                "provider": "vapi",
                "areaCode": area_code,
                "assistantId": assistant_id,
                "name": f"{business_name} Line",
            },
            # Fallback: no area code constraint — any available US number.
            {
                "provider": "vapi",
                "assistantId": assistant_id,
                "name": f"{business_name} Line",
            },
        ]:
            try:
                resp = await http.post(
                    f"{_VAPI_BASE}/phone-number",
                    headers=_headers(),
                    json=attempt_payload,
                )
                if resp.status_code == 400 and "areaCode" in attempt_payload:
                    # No inventory in this area code — try without constraint.
                    logger.info(
                        "Vapi: no number in area code, trying any US number",
                        area_code=area_code,
                        client_id=client_id,
                    )
                    continue
                resp.raise_for_status()
                break
            except httpx.HTTPStatusError as exc:
                if "areaCode" in attempt_payload:
                    # Will retry without area code.
                    continue
                logger.error(
                    "Vapi buy_phone_number failed",
                    client_id=client_id,
                    status=exc.response.status_code,
                    body=exc.response.text[:500],
                )
                raise VapiServiceError(
                    f"Vapi phone purchase error {exc.response.status_code}: {exc.response.text[:200]}"
                ) from exc
            except httpx.RequestError as exc:
                logger.error("Vapi buy_phone_number network error", client_id=client_id, error=str(exc))
                raise VapiServiceError(f"Vapi network error: {exc}") from exc
        else:
            raise VapiServiceError(
                f"Vapi has no available numbers for area code {area_code} or any fallback"
            )

    data = resp.json()
    vapi_phone_id: str | None = data.get("id")
    phone_number: str | None = data.get("number")
    if not vapi_phone_id or not phone_number:
        raise VapiServiceError(f"Vapi phone-number response missing fields: {data}")

    logger.info(
        "Vapi phone number purchased",
        client_id=client_id,
        phone=phone_number,
        vapi_phone_id=vapi_phone_id,
        assistant_id=assistant_id,
    )
    return vapi_phone_id, phone_number


async def delete_phone_number(vapi_phone_id: str) -> None:
    """Delete a Vapi-native phone number (used during onboarding rollback).

    Releases the number back to Vapi's pool. No effect on Twilio.

    Args:
        vapi_phone_id: Vapi phone number ID returned by buy_phone_number.

    Raises:
        VapiServiceError: on any API error.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.delete(
                f"{_VAPI_BASE}/phone-number/{vapi_phone_id}",
                headers=_headers(),
            )
            resp.raise_for_status()
            logger.info("Vapi phone number deleted", vapi_phone_id=vapi_phone_id)
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Vapi delete_phone_number failed",
                vapi_phone_id=vapi_phone_id,
                status=exc.response.status_code,
            )
            raise VapiServiceError(
                f"Vapi phone delete error {exc.response.status_code}: {exc.response.text[:200]}"
            ) from exc
        except httpx.RequestError as exc:
            logger.error("Vapi delete_phone_number network error", vapi_phone_id=vapi_phone_id, error=str(exc))
            raise VapiServiceError(f"Vapi network error: {exc}") from exc
