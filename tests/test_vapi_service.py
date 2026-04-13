"""
Tests for backend/services/vapi_service.py

All Vapi API calls are mocked with httpx.MockTransport / respx so these run
fully offline. No real Vapi account or API key required.
"""
from __future__ import annotations

import json
import pytest
import respx
import httpx
from unittest.mock import patch

from backend.services.vapi_service import (
    create_assistant,
    update_assistant,
    delete_assistant,
    VapiServiceError,
    _VAPI_BASE,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

CLIENT_CONFIG = {
    "business_name": "Test Plumbing Co",
    "services_offered": ["plumbing", "drain cleaning"],
    "working_hours": {"Mon": "8am-6pm", "Fri": "8am-6pm"},
    "emergency_phone_number": "+15550000000",
}

CLIENT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
ASSISTANT_ID = "vapi-asst-12345"


# ---------------------------------------------------------------------------
# create_assistant tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@respx.mock
async def test_create_assistant_returns_assistant_id():
    """create_assistant should return the 'id' field from the Vapi response."""
    respx.post(f"{_VAPI_BASE}/assistant").mock(
        return_value=httpx.Response(200, json={"id": ASSISTANT_ID, "name": "Test Plumbing Co Agent"})
    )

    result = await create_assistant(CLIENT_CONFIG, CLIENT_ID)
    assert result == ASSISTANT_ID


@pytest.mark.asyncio
@respx.mock
async def test_create_assistant_uses_correct_webhook_url():
    """create_assistant should set serverUrl to VAPI_WEBHOOK_BASE_URL/webhook/vapi."""
    captured: dict = {}

    def capture_request(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": ASSISTANT_ID})

    respx.post(f"{_VAPI_BASE}/assistant").mock(side_effect=capture_request)

    with patch("backend.services.vapi_service.settings") as mock_settings:
        mock_settings.vapi_api_key = "test-key"
        mock_settings.vapi_webhook_base_url = "https://myapp.railway.app"
        mock_settings.vapi_webhook_secret = "secret123"
        await create_assistant(CLIENT_CONFIG, CLIENT_ID)

    assert captured["body"]["serverUrl"] == "https://myapp.railway.app/webhook/vapi"


@pytest.mark.asyncio
@respx.mock
async def test_create_assistant_includes_business_name_in_greeting():
    """firstMessage should include the business name."""
    captured: dict = {}

    def capture_request(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": ASSISTANT_ID})

    respx.post(f"{_VAPI_BASE}/assistant").mock(side_effect=capture_request)

    await create_assistant(CLIENT_CONFIG, CLIENT_ID)

    assert "Test Plumbing Co" in captured["body"]["firstMessage"]
    assert "Test Plumbing Co" in captured["body"]["name"]


@pytest.mark.asyncio
@respx.mock
async def test_create_assistant_raises_on_api_error():
    """create_assistant should raise VapiServiceError on non-200 response."""
    respx.post(f"{_VAPI_BASE}/assistant").mock(
        return_value=httpx.Response(401, json={"error": "Unauthorized"})
    )

    with pytest.raises(VapiServiceError):
        await create_assistant(CLIENT_CONFIG, CLIENT_ID)


@pytest.mark.asyncio
@respx.mock
async def test_delete_assistant_called_on_rollback():
    """delete_assistant should DELETE to the correct Vapi URL."""
    delete_route = respx.delete(f"{_VAPI_BASE}/assistant/{ASSISTANT_ID}").mock(
        return_value=httpx.Response(200, json={"id": ASSISTANT_ID, "deleted": True})
    )

    await delete_assistant(ASSISTANT_ID)

    assert delete_route.called


@pytest.mark.asyncio
@respx.mock
async def test_update_assistant_called_on_settings_change():
    """update_assistant should PATCH the correct URL with updated name."""
    captured: dict = {}

    def capture_request(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": ASSISTANT_ID})

    respx.patch(f"{_VAPI_BASE}/assistant/{ASSISTANT_ID}").mock(side_effect=capture_request)

    updated_config = {**CLIENT_CONFIG, "business_name": "New Plumbing Name"}
    await update_assistant(ASSISTANT_ID, updated_config)

    assert "New Plumbing Name" in captured["body"]["name"]
    assert "New Plumbing Name" in captured["body"]["firstMessage"]
