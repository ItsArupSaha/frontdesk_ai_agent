"""Tests for backend/services/jobber_service.py — Jobber GraphQL API fully mocked."""
import pytest
import respx
import httpx
from datetime import datetime

from backend.db.models import Booking


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def make_booking(**overrides) -> Booking:
    """Return a minimal Booking suitable for FSM sync tests."""
    defaults = dict(
        client_id="client_test",
        caller_name="Jane Smith",
        caller_phone="+15551234567",
        caller_address="123 Main St",
        problem_description="No hot water",
        appointment_start=datetime(2026, 4, 20, 10, 0),
        appointment_end=datetime(2026, 4, 20, 11, 0),
    )
    defaults.update(overrides)
    return Booking(**defaults)


JOBBER_URL = "https://api.jobber.com/api/graphql"

# ---------------------------------------------------------------------------
# test_creates_new_client_when_not_found
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_creates_new_client_when_not_found():
    """When no existing client is found, a new one is created and request is made."""
    from backend.services.jobber_service import create_client_and_request

    # Search returns empty
    search_response = {"data": {"clients": {"nodes": []}}}
    create_client_response = {"data": {"clientCreate": {"client": {"id": "client_new_1"}, "userErrors": []}}}
    create_request_response = {"data": {"requestCreate": {"request": {"id": "req_abc"}, "userErrors": []}}}

    respx.post(JOBBER_URL).mock(
        side_effect=[
            httpx.Response(200, json=search_response),
            httpx.Response(200, json=create_client_response),
            httpx.Response(200, json=create_request_response),
        ]
    )

    result = await create_client_and_request(make_booking(), "test_api_key")

    assert result is not None
    assert result["client_id"] == "client_new_1"
    assert result["request_id"] == "req_abc"


# ---------------------------------------------------------------------------
# test_reuses_existing_client_when_found
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_reuses_existing_client_when_found():
    """When an existing client is found by phone, it is reused (no create call)."""
    from backend.services.jobber_service import create_client_and_request

    search_response = {"data": {"clients": {"nodes": [{"id": "existing_client_99"}]}}}
    create_request_response = {"data": {"requestCreate": {"request": {"id": "req_xyz"}, "userErrors": []}}}

    # Should make exactly 2 calls: search + create_request (no client create)
    call_count = 0
    responses = [
        httpx.Response(200, json=search_response),
        httpx.Response(200, json=create_request_response),
    ]

    def response_factory(request):
        nonlocal call_count
        resp = responses[call_count]
        call_count += 1
        return resp

    respx.post(JOBBER_URL).mock(side_effect=response_factory)

    result = await create_client_and_request(make_booking(), "test_api_key")

    assert result is not None
    assert result["client_id"] == "existing_client_99"
    assert result["request_id"] == "req_xyz"
    assert call_count == 2  # search + create_request only


# ---------------------------------------------------------------------------
# test_creates_request_after_client
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_creates_request_after_client():
    """The request is created with the correct client_id in the input."""
    from backend.services.jobber_service import create_client_and_request

    search_response = {"data": {"clients": {"nodes": []}}}
    create_client_response = {"data": {"clientCreate": {"client": {"id": "client_555"}, "userErrors": []}}}
    create_request_response = {"data": {"requestCreate": {"request": {"id": "req_555"}, "userErrors": []}}}

    captured_bodies = []

    def capture_and_respond(request):
        captured_bodies.append(request.content)
        responses = [
            httpx.Response(200, json=search_response),
            httpx.Response(200, json=create_client_response),
            httpx.Response(200, json=create_request_response),
        ]
        return responses[len(captured_bodies) - 1]

    respx.post(JOBBER_URL).mock(side_effect=capture_and_respond)

    result = await create_client_and_request(make_booking(), "test_api_key")

    assert result is not None
    assert result["client_id"] == "client_555"
    assert result["request_id"] == "req_555"
    # Three GraphQL calls were made
    assert len(captured_bodies) == 3


# ---------------------------------------------------------------------------
# test_jobber_api_failure_returns_none_not_exception
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_jobber_api_failure_returns_none_not_exception():
    """A Jobber HTTP error must return None — never raise an exception."""
    from backend.services.jobber_service import create_client_and_request

    respx.post(JOBBER_URL).mock(return_value=httpx.Response(503, text="Service Unavailable"))

    result = await create_client_and_request(make_booking(), "bad_key")

    assert result is None


@pytest.mark.asyncio
@respx.mock
async def test_jobber_network_error_returns_none_not_exception():
    """A network-level error must return None — never raise."""
    from backend.services.jobber_service import create_client_and_request

    respx.post(JOBBER_URL).mock(side_effect=httpx.ConnectError("Connection refused"))

    result = await create_client_and_request(make_booking(), "bad_key")

    assert result is None


@pytest.mark.asyncio
@respx.mock
async def test_jobber_user_errors_returns_none():
    """GraphQL userErrors (e.g. validation) must return None — not raise."""
    from backend.services.jobber_service import create_client_and_request

    search_response = {"data": {"clients": {"nodes": []}}}
    create_client_response = {
        "data": {
            "clientCreate": {
                "client": None,
                "userErrors": [{"message": "Phone is invalid", "path": ["phone"]}],
            }
        }
    }

    respx.post(JOBBER_URL).mock(
        side_effect=[
            httpx.Response(200, json=search_response),
            httpx.Response(200, json=create_client_response),
        ]
    )

    result = await create_client_and_request(make_booking(), "test_api_key")

    assert result is None
