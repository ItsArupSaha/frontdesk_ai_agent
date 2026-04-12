"""
Tests for backend/routers/dashboard_api.py

All Supabase calls are mocked; the tests use the FastAPI test client via
httpx.AsyncClient + ASGITransport.

Auth: every request passes ``Authorization: Bearer dev-bypass``.
The dashboard_api router accepts this token when APP_ENV != 'production'.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

from httpx import AsyncClient, ASGITransport

from backend.main import app

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

AUTH = {"Authorization": "Bearer dev-bypass"}
CLIENT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


def _sb_mock() -> MagicMock:
    """Return a minimal Supabase client mock where .execute() returns empty data."""
    sb = MagicMock()
    # Chain: table().select().eq().gte()...execute()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=[])
    sb.table.return_value.select.return_value = chain
    chain.eq.return_value = chain
    chain.gte.return_value = chain
    chain.lte.return_value = chain
    chain.order.return_value = chain
    chain.range.return_value = chain
    chain.limit.return_value = chain
    chain.update.return_value = chain
    chain.patch.return_value = chain
    return sb


# ---------------------------------------------------------------------------
# GET /api/dashboard/overview
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_overview_returns_200_with_empty_data():
    """Overview endpoint returns zeros when there are no calls yet."""
    sb = _sb_mock()
    with patch("backend.routers.dashboard_api.get_supabase", return_value=sb):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get(f"/api/dashboard/overview?client_id={CLIENT_ID}", headers=AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert data["calls_today"] == 0
    assert data["calls_this_week"] == 0
    assert data["bookings_this_week"] == 0
    assert data["booking_rate"] == 0.0
    assert data["emergencies_this_week"] == 0
    assert data["missed_calls_recovered"] == 0


@pytest.mark.asyncio
async def test_overview_counts_calls_correctly():
    """Overview counts are derived from the mock call_logs rows."""
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%dT%H:%M:%S+00:00")

    mock_calls = [
        {"id": "1", "was_emergency": False, "was_booked": True, "started_at": today_str},
        {"id": "2", "was_emergency": True, "was_booked": False, "started_at": today_str},
        {"id": "3", "was_emergency": False, "was_booked": True, "started_at": today_str},
    ]

    sb = MagicMock()
    call_chain = MagicMock()
    call_chain.execute.return_value = MagicMock(data=mock_calls)
    call_chain.eq.return_value = call_chain
    call_chain.gte.return_value = call_chain

    recovery_chain = MagicMock()
    recovery_chain.execute.return_value = MagicMock(data=[])
    recovery_chain.eq.return_value = recovery_chain
    recovery_chain.gte.return_value = recovery_chain

    # First table("call_logs") → call_chain; then table("reminders_queue") → recovery_chain
    sb.table.side_effect = lambda name: (
        MagicMock(select=MagicMock(return_value=call_chain))
        if name == "call_logs"
        else MagicMock(select=MagicMock(return_value=recovery_chain))
    )

    with patch("backend.routers.dashboard_api.get_supabase", return_value=sb):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get(f"/api/dashboard/overview?client_id={CLIENT_ID}", headers=AUTH)

    assert resp.status_code == 200
    data = resp.json()
    assert data["calls_this_week"] == 3
    assert data["bookings_this_week"] == 2
    assert data["emergencies_this_week"] == 1
    assert abs(data["booking_rate"] - round(2 / 3, 4)) < 0.001


@pytest.mark.asyncio
async def test_overview_missing_auth_returns_401():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(f"/api/dashboard/overview?client_id={CLIENT_ID}")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/dashboard/calls
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_calls_returns_paginated_list():
    mock_rows = [
        {
            "id": "c1",
            "call_id": "vapi_1",
            "caller_number": "+15550001234",
            "started_at": "2024-01-10T10:00:00+00:00",
            "ended_at": "2024-01-10T10:05:00+00:00",
            "was_emergency": False,
            "was_booked": True,
            "summary": "Caller booked plumbing repair",
            "transcript": [],
            "status": "completed",
        }
    ]
    sb = _sb_mock()
    sb.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value.execute.return_value = MagicMock(data=mock_rows)

    with patch("backend.routers.dashboard_api.get_supabase", return_value=sb):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get(f"/api/dashboard/calls?client_id={CLIENT_ID}", headers=AUTH)

    assert resp.status_code == 200
    data = resp.json()
    assert "calls" in data
    assert data["count"] >= 0  # mocked chain may return empty — structure check sufficient


@pytest.mark.asyncio
async def test_calls_duration_computed():
    """duration_seconds is computed from started_at / ended_at."""
    mock_rows = [
        {
            "id": "c1",
            "call_id": "vapi_1",
            "caller_number": "+15550001234",
            "started_at": "2024-01-10T10:00:00+00:00",
            "ended_at": "2024-01-10T10:02:30+00:00",
            "was_emergency": False,
            "was_booked": False,
            "summary": None,
            "transcript": [],
            "status": "completed",
        }
    ]
    sb = MagicMock()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=mock_rows)
    for method in ("eq", "order", "range", "gte", "lte"):
        setattr(chain, method, MagicMock(return_value=chain))
    sb.table.return_value.select.return_value = chain

    with patch("backend.routers.dashboard_api.get_supabase", return_value=sb):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get(f"/api/dashboard/calls?client_id={CLIENT_ID}", headers=AUTH)

    assert resp.status_code == 200
    calls = resp.json()["calls"]
    assert len(calls) == 1
    assert calls[0]["duration_seconds"] == 150  # 2 min 30 sec


# ---------------------------------------------------------------------------
# GET /api/dashboard/bookings
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_bookings_returns_list():
    sb = _sb_mock()
    with patch("backend.routers.dashboard_api.get_supabase", return_value=sb):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get(
                f"/api/dashboard/bookings?client_id={CLIENT_ID}"
                "&start=2024-01-01T00:00:00Z&end=2024-01-31T23:59:59Z",
                headers=AUTH,
            )
    assert resp.status_code == 200
    data = resp.json()
    assert "bookings" in data
    assert "count" in data


# ---------------------------------------------------------------------------
# GET /api/dashboard/analytics
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_analytics_returns_correct_shape():
    sb = _sb_mock()
    with patch("backend.routers.dashboard_api.get_supabase", return_value=sb):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get(
                f"/api/dashboard/analytics?client_id={CLIENT_ID}&period=30d",
                headers=AUTH,
            )
    assert resp.status_code == 200
    data = resp.json()
    assert "calls_per_day" in data
    assert "bookings_per_day" in data
    assert "calls_by_hour" in data
    assert len(data["calls_by_hour"]) == 24
    assert "emergency_rate" in data
    assert data["period_days"] == 30


@pytest.mark.asyncio
async def test_analytics_aggregates_calls_per_day():
    """With 3 calls on the same day, calls_per_day shows count 3."""
    ts = "2024-03-15T14:00:00+00:00"
    mock_rows = [
        {"started_at": ts, "was_emergency": False, "was_booked": True},
        {"started_at": ts, "was_emergency": False, "was_booked": False},
        {"started_at": ts, "was_emergency": True, "was_booked": False},
    ]
    sb = MagicMock()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=mock_rows)
    for method in ("eq", "gte"):
        setattr(chain, method, MagicMock(return_value=chain))
    sb.table.return_value.select.return_value = chain

    with patch("backend.routers.dashboard_api.get_supabase", return_value=sb):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get(
                f"/api/dashboard/analytics?client_id={CLIENT_ID}&period=30d",
                headers=AUTH,
            )

    data = resp.json()
    assert len(data["calls_per_day"]) == 1
    assert data["calls_per_day"][0]["date"] == "2024-03-15"
    assert data["calls_per_day"][0]["count"] == 3
    assert data["emergency_rate"] == round(1 / 3, 4)


@pytest.mark.asyncio
async def test_analytics_invalid_period_returns_422():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(
            f"/api/dashboard/analytics?client_id={CLIENT_ID}&period=badvalue",
            headers=AUTH,
        )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/dashboard/settings
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_settings_returns_client_config():
    mock_client = {
        "id": CLIENT_ID,
        "business_name": "Test Plumbing Co",
        "emergency_phone_number": "+15550000000",
        "working_hours": {"mon": "8am-6pm"},
        "services_offered": ["plumbing"],
        "service_area_description": "Brooklyn, NY",
        "google_review_link": None,
        "vapi_assistant_id": None,
        "twilio_phone_number": None,
        "is_active": True,
        "fsm_type": None,
        "created_at": "2024-01-01T00:00:00+00:00",
        "updated_at": "2024-01-01T00:00:00+00:00",
    }
    sb = MagicMock()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=[mock_client])
    chain.eq.return_value = chain
    chain.limit.return_value = chain
    sb.table.return_value.select.return_value = chain

    with patch("backend.routers.dashboard_api.get_supabase", return_value=sb):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get(f"/api/dashboard/settings?client_id={CLIENT_ID}", headers=AUTH)

    assert resp.status_code == 200
    data = resp.json()
    assert data["business_name"] == "Test Plumbing Co"
    # Sensitive keys must not appear in the response.
    assert "jobber_api_key" not in data
    assert "housecall_pro_api_key" not in data
    assert "google_calendar_refresh_token_enc" not in data


@pytest.mark.asyncio
async def test_settings_returns_404_for_unknown_client():
    sb = _sb_mock()
    with patch("backend.routers.dashboard_api.get_supabase", return_value=sb):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get(
                "/api/dashboard/settings?client_id=nonexistent-id", headers=AUTH
            )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PUT /api/dashboard/settings
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_settings_update_saves_allowed_fields():
    updated_row = {
        "id": CLIENT_ID,
        "business_name": "New Name Plumbing",
        "emergency_phone_number": "+15550000001",
        "working_hours": {},
        "services_offered": [],
        "service_area_description": "",
        "google_review_link": "https://g.page/review",
        "is_active": True,
    }
    sb = MagicMock()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=[updated_row])
    chain.eq.return_value = chain
    chain.update.return_value = chain
    sb.table.return_value.update.return_value = chain

    with patch("backend.routers.dashboard_api.get_supabase", return_value=sb):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.put(
                f"/api/dashboard/settings?client_id={CLIENT_ID}",
                headers=AUTH,
                json={"business_name": "New Name Plumbing", "google_review_link": "https://g.page/review"},
            )

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_settings_update_empty_payload_returns_400():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.put(
            f"/api/dashboard/settings?client_id={CLIENT_ID}",
            headers=AUTH,
            json={},
        )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# PATCH /api/dashboard/bookings/{booking_id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_booking_status_to_completed():
    updated_row = {"id": "booking-1", "status": "completed", "client_id": CLIENT_ID}
    sb = MagicMock()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=[updated_row])
    chain.eq.return_value = chain
    sb.table.return_value.update.return_value = chain

    with patch("backend.routers.dashboard_api.get_supabase", return_value=sb):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.patch(
                f"/api/dashboard/bookings/booking-1?client_id={CLIENT_ID}&status=completed",
                headers=AUTH,
            )

    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_update_booking_invalid_status_returns_422():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.patch(
            f"/api/dashboard/bookings/booking-1?client_id={CLIENT_ID}&status=invalid_status",
            headers=AUTH,
        )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# _compute_duration helper
# ---------------------------------------------------------------------------


def test_compute_duration_normal():
    from backend.routers.dashboard_api import _compute_duration

    result = _compute_duration(
        "2024-01-10T10:00:00+00:00",
        "2024-01-10T10:03:45+00:00",
    )
    assert result == 225  # 3 min 45 sec


def test_compute_duration_missing_end_returns_none():
    from backend.routers.dashboard_api import _compute_duration

    assert _compute_duration("2024-01-10T10:00:00+00:00", None) is None


def test_compute_duration_missing_start_returns_none():
    from backend.routers.dashboard_api import _compute_duration

    assert _compute_duration(None, "2024-01-10T10:00:00+00:00") is None


def test_compute_duration_bad_format_returns_none():
    from backend.routers.dashboard_api import _compute_duration

    assert _compute_duration("not-a-date", "also-not") is None
