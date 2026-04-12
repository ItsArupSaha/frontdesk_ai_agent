"""Tests for backend/services/housecall_service.py — Housecall Pro REST API fully mocked."""
import pytest
import respx
import httpx
from datetime import datetime

from backend.db.models import Booking

HCP_BASE_URL = "https://api.housecallpro.com"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def make_booking(**overrides) -> Booking:
    """Return a minimal Booking for HCP sync tests."""
    defaults = dict(
        client_id="client_test",
        caller_name="Bob Jones",
        caller_phone="+15559876543",
        caller_address="456 Oak Ave",
        problem_description="AC not cooling",
        appointment_start=datetime(2026, 4, 21, 14, 0),
        appointment_end=datetime(2026, 4, 21, 15, 0),
    )
    defaults.update(overrides)
    return Booking(**defaults)


# ---------------------------------------------------------------------------
# test_creates_customer_and_job
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_creates_customer_and_job():
    """Customer and job are created in sequence; IDs returned in result dict."""
    from backend.services.housecall_service import create_customer_and_job

    respx.post(f"{HCP_BASE_URL}/customers").mock(
        return_value=httpx.Response(200, json={"id": "cust_abc123"})
    )
    respx.post(f"{HCP_BASE_URL}/jobs").mock(
        return_value=httpx.Response(200, json={"id": "job_def456"})
    )

    result = await create_customer_and_job(make_booking(), "test_hcp_key")

    assert result is not None
    assert result["customer_id"] == "cust_abc123"
    assert result["job_id"] == "job_def456"


@pytest.mark.asyncio
@respx.mock
async def test_creates_customer_with_correct_fields():
    """Customer POST body contains the caller's name and phone."""
    from backend.services.housecall_service import create_customer_and_job
    import json

    captured = {}

    def capture_customer(request):
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "cust_capture"})

    respx.post(f"{HCP_BASE_URL}/customers").mock(side_effect=capture_customer)
    respx.post(f"{HCP_BASE_URL}/jobs").mock(
        return_value=httpx.Response(200, json={"id": "job_capture"})
    )

    booking = make_booking(caller_name="Alice Wonder", caller_phone="+15550001234")
    await create_customer_and_job(booking, "test_hcp_key")

    assert captured["body"]["first_name"] == "Alice"
    assert captured["body"]["last_name"] == "Wonder"
    assert captured["body"]["mobile_number"] == "+15550001234"


@pytest.mark.asyncio
@respx.mock
async def test_creates_job_with_customer_id():
    """Job POST body contains the customer_id returned from customer creation."""
    from backend.services.housecall_service import create_customer_and_job
    import json

    captured = {}

    respx.post(f"{HCP_BASE_URL}/customers").mock(
        return_value=httpx.Response(200, json={"id": "cust_linked"})
    )

    def capture_job(request):
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "job_linked"})

    respx.post(f"{HCP_BASE_URL}/jobs").mock(side_effect=capture_job)

    await create_customer_and_job(make_booking(), "test_hcp_key")

    assert captured["body"]["customer_id"] == "cust_linked"


# ---------------------------------------------------------------------------
# test_hcp_api_failure_returns_none_not_exception
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_hcp_api_failure_on_customer_returns_none():
    """HTTP error on customer creation returns None — never raises."""
    from backend.services.housecall_service import create_customer_and_job

    respx.post(f"{HCP_BASE_URL}/customers").mock(
        return_value=httpx.Response(500, text="Internal Server Error")
    )

    result = await create_customer_and_job(make_booking(), "bad_key")

    assert result is None


@pytest.mark.asyncio
@respx.mock
async def test_hcp_api_failure_on_job_returns_none():
    """HTTP error on job creation returns None — never raises."""
    from backend.services.housecall_service import create_customer_and_job

    respx.post(f"{HCP_BASE_URL}/customers").mock(
        return_value=httpx.Response(200, json={"id": "cust_ok"})
    )
    respx.post(f"{HCP_BASE_URL}/jobs").mock(
        return_value=httpx.Response(422, text="Unprocessable Entity")
    )

    result = await create_customer_and_job(make_booking(), "bad_key")

    assert result is None


@pytest.mark.asyncio
@respx.mock
async def test_hcp_network_error_returns_none():
    """Network-level error returns None — never raises."""
    from backend.services.housecall_service import create_customer_and_job

    respx.post(f"{HCP_BASE_URL}/customers").mock(
        side_effect=httpx.ConnectError("Connection refused")
    )

    result = await create_customer_and_job(make_booking(), "bad_key")

    assert result is None
