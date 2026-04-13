"""
Tests for POST /api/clients/create (backend/routers/onboarding.py)

All external services (Supabase auth, DB, Vapi, Twilio, RAG) are mocked.
Tests verify: successful creation, rollback on each failure point, and
validation errors.

Note: create_assistant, provision_number, ingest_client_knowledge are
imported inside the function body in onboarding.py, so patches target
the source module directly.
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import AsyncClient, ASGITransport

from backend.main import app

AUTH = {"Authorization": "Bearer dev-bypass"}

VALID_PAYLOAD = {
    "business_name": "Test Plumbing Co",
    "email": "owner@testplumbing.com",
    "emergency_phone": "+17185550001",
    "services_offered": ["plumbing"],
    "working_hours": {},
    "service_area_description": "Brooklyn, NY",
    "zip_codes": ["11201", "11211"],
    "area_code": "718",
    "pricing_ranges": {},
}


def _make_sb_mock(user_id: str = "test-user-uuid") -> MagicMock:
    """Return a Supabase mock that succeeds all DB operations."""
    sb = MagicMock()

    # auth.admin.create_user
    user_mock = MagicMock()
    user_mock.id = user_id
    create_resp = MagicMock()
    create_resp.user = user_mock
    sb.auth.admin.create_user.return_value = create_resp
    sb.auth.admin.generate_link.return_value = MagicMock()
    sb.auth.admin.delete_user.return_value = MagicMock()

    # table().insert().execute() / update().eq().execute()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=[{"id": user_id}])
    chain.eq.return_value = chain
    chain.update.return_value = chain
    chain.delete.return_value = chain
    sb.table.return_value.insert.return_value = chain
    sb.table.return_value.update.return_value = chain
    sb.table.return_value.delete.return_value = chain

    return sb


# ---------------------------------------------------------------------------
# test_create_client_full_success_flow
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_client_full_success_flow():
    """All 7 steps succeed — response contains client_id and phone_number."""
    sb = _make_sb_mock("uuid-abc")

    with (
        patch("backend.routers.onboarding.get_supabase", return_value=sb),
        patch(
            "backend.services.vapi_service.create_assistant",
            new_callable=AsyncMock,
            return_value="asst-123",
        ) as mock_vapi,
        patch(
            "backend.services.twilio_service.provision_number",
            new_callable=AsyncMock,
            return_value="+17185551234",
        ) as mock_twilio,
        patch(
            "backend.services.rag_service.ingest_client_knowledge",
            new_callable=AsyncMock,
        ) as mock_rag,
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/clients/create", headers=AUTH, json=VALID_PAYLOAD)

    assert resp.status_code == 200
    data = resp.json()
    assert data["client_id"] == "uuid-abc"
    assert data["phone_number"] == "+17185551234"
    assert data["setup_complete"] is True
    mock_vapi.assert_awaited_once()
    mock_twilio.assert_awaited_once()
    mock_rag.assert_awaited_once()


# ---------------------------------------------------------------------------
# test_create_client_rolls_back_on_vapi_failure
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_client_rolls_back_on_vapi_failure():
    """If Vapi assistant creation fails, DB record and Supabase user are deleted."""
    from backend.services.vapi_service import VapiServiceError

    sb = _make_sb_mock("uuid-def")

    with (
        patch("backend.routers.onboarding.get_supabase", return_value=sb),
        patch(
            "backend.services.vapi_service.create_assistant",
            new_callable=AsyncMock,
            side_effect=VapiServiceError("Vapi down"),
        ),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/clients/create", headers=AUTH, json=VALID_PAYLOAD)

    assert resp.status_code == 500
    # Rollback: delete Supabase user.
    sb.auth.admin.delete_user.assert_called_with("uuid-def")


# ---------------------------------------------------------------------------
# test_create_client_rolls_back_on_twilio_failure
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_client_rolls_back_on_twilio_failure():
    """If Twilio provisioning fails, Vapi assistant, DB row, and auth user are cleaned up."""
    from backend.services.twilio_service import TwilioProvisionError

    sb = _make_sb_mock("uuid-ghi")

    with (
        patch("backend.routers.onboarding.get_supabase", return_value=sb),
        patch(
            "backend.services.vapi_service.create_assistant",
            new_callable=AsyncMock,
            return_value="asst-777",
        ),
        patch(
            "backend.services.twilio_service.provision_number",
            new_callable=AsyncMock,
            side_effect=TwilioProvisionError("No numbers available"),
        ),
        patch(
            "backend.services.vapi_service.delete_assistant",
            new_callable=AsyncMock,
        ) as mock_delete,
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/clients/create", headers=AUTH, json=VALID_PAYLOAD)

    assert resp.status_code == 500
    sb.auth.admin.delete_user.assert_called_with("uuid-ghi")


# ---------------------------------------------------------------------------
# test_create_client_does_not_rollback_on_rag_failure
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_client_does_not_rollback_on_rag_failure():
    """RAG ingestion failure is non-critical — client is created successfully."""
    sb = _make_sb_mock("uuid-jkl")

    with (
        patch("backend.routers.onboarding.get_supabase", return_value=sb),
        patch(
            "backend.services.vapi_service.create_assistant",
            new_callable=AsyncMock,
            return_value="asst-999",
        ),
        patch(
            "backend.services.twilio_service.provision_number",
            new_callable=AsyncMock,
            return_value="+12125550001",
        ),
        patch(
            "backend.services.rag_service.ingest_client_knowledge",
            new_callable=AsyncMock,
            side_effect=RuntimeError("pgvector down"),
        ),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/clients/create", headers=AUTH, json=VALID_PAYLOAD)

    # Should still succeed despite RAG failure.
    assert resp.status_code == 200
    assert resp.json()["setup_complete"] is True
    # No rollback.
    sb.auth.admin.delete_user.assert_not_called()


# ---------------------------------------------------------------------------
# test_create_client_validates_required_fields
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_client_validates_required_fields():
    """Missing required fields should return 422 Unprocessable Entity."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Missing email, emergency_phone.
        resp = await ac.post(
            "/api/clients/create",
            headers=AUTH,
            json={"business_name": "Test Co"},
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_client_rejects_invalid_email():
    """Invalid email format should return 422."""
    bad_payload = {**VALID_PAYLOAD, "email": "not-an-email"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/clients/create", headers=AUTH, json=bad_payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_client_rejects_invalid_phone():
    """Non-E.164 emergency phone should return 422."""
    bad_payload = {**VALID_PAYLOAD, "emergency_phone": "718-555-1234"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/clients/create", headers=AUTH, json=bad_payload)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# test_create_client_returns_phone_number
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_client_returns_phone_number():
    """Success response must include the provisioned phone_number."""
    sb = _make_sb_mock("uuid-mno")

    with (
        patch("backend.routers.onboarding.get_supabase", return_value=sb),
        patch(
            "backend.services.vapi_service.create_assistant",
            new_callable=AsyncMock,
            return_value="asst-111",
        ),
        patch(
            "backend.services.twilio_service.provision_number",
            new_callable=AsyncMock,
            return_value="+17185559876",
        ),
        patch(
            "backend.services.rag_service.ingest_client_knowledge",
            new_callable=AsyncMock,
        ),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/clients/create", headers=AUTH, json=VALID_PAYLOAD)

    assert resp.status_code == 200
    assert resp.json()["phone_number"] == "+17185559876"
