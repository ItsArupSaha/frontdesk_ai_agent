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
