"""
Tests for backend/routers/admin.py

All Supabase calls are mocked. Auth uses dev-bypass (APP_ENV != production).
In dev-bypass mode, get_current_user returns sub='dev-user' which require_admin
treats as admin unconditionally.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from httpx import AsyncClient, ASGITransport

from backend.main import app

AUTH = {"Authorization": "Bearer dev-bypass"}
NON_ADMIN_AUTH = {"Authorization": "Bearer non-admin-token"}

CLIENT_ID = "client-uuid-1111"
ADMIN_ID = "admin-uuid-9999"


def _sb_mock_for_admin() -> MagicMock:
    """Return Supabase mock with admin role for dev-bypass user."""
    sb = MagicMock()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=[])
    chain.eq.return_value = chain
    chain.gte.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    chain.update.return_value = chain
    sb.table.return_value.select.return_value = chain
    sb.table.return_value.update.return_value = chain
    return sb


# ---------------------------------------------------------------------------
# test_admin_route_returns_403_for_client_role
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_route_returns_403_for_client_role():
    """Non-admin token should get 403 on admin routes (outside dev-bypass).

    Auth flow:
      1. get_current_user calls sb.auth.get_user — returns a real user.
      2. require_admin queries the admins table — user NOT found → 403.
    """
    sb = MagicMock()
    # auth.get_user succeeds — the user exists in Supabase auth.
    user_mock = MagicMock()
    user_mock.id = "client-only-user"
    user_mock.email = "client@test.com"
    user_resp = MagicMock()
    user_resp.user = user_mock
    sb.auth.get_user.return_value = user_resp
    # admins table lookup: user NOT in admins table → 403.
    admins_chain = MagicMock()
    admins_chain.execute.return_value = MagicMock(data=[])  # empty = not an admin
    admins_chain.eq.return_value = admins_chain
    admins_chain.limit.return_value = admins_chain
    sb.table.return_value.select.return_value = admins_chain

    with patch("backend.utils.auth.get_supabase", return_value=sb):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/admin/clients", headers=NON_ADMIN_AUTH)

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# test_admin_route_returns_200_for_admin_role (dev-bypass)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_route_returns_200_for_admin_role():
    """Dev-bypass token returns 200 on admin routes (treated as admin)."""
    sb = _sb_mock_for_admin()
    # clients list returns one client.
    clients_chain = MagicMock()
    clients_chain.execute.return_value = MagicMock(
        data=[{"id": CLIENT_ID, "business_name": "Test Co", "email": None, "is_active": True}]
    )
    calls_chain = MagicMock()
    calls_chain.execute.return_value = MagicMock(data=[])
    calls_chain.eq.return_value = calls_chain
    calls_chain.gte.return_value = calls_chain
    calls_chain.order.return_value = calls_chain
    calls_chain.limit.return_value = calls_chain
    sb.table.return_value.select.return_value = clients_chain

    # For the nested calls/bookings queries, return empty.
    def table_selector(name: str):
        tbl = MagicMock()
        tbl.select.return_value = calls_chain
        return tbl

    sb.table.side_effect = table_selector

    with patch("backend.routers.admin.get_supabase", return_value=sb):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/admin/clients", headers=AUTH)

    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# test_get_all_clients_returns_correct_stats
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_all_clients_returns_correct_stats():
    """GET /api/admin/clients should compute calls/bookings counts and monthly cost."""
    now_str = datetime.now(timezone.utc).isoformat()

    client_row = {"id": CLIENT_ID, "business_name": "Test Co", "email": "a@b.com", "is_active": True}
    call_rows = [
        {"id": "c1", "started_at": now_str, "was_booked": True},
        {"id": "c2", "started_at": now_str, "was_booked": False},
    ]
    booking_rows = [{"id": "b1"}]
    last_call = [{"started_at": now_str}]

    def make_chain(data: list) -> MagicMock:
        chain = MagicMock()
        chain.execute.return_value = MagicMock(data=data)
        chain.eq.return_value = chain
        chain.gte.return_value = chain
        chain.order.return_value = chain
        chain.limit.return_value = chain
        return chain

    sb = MagicMock()

    call_count = [0]

    def table_side_effect(name: str) -> MagicMock:
        tbl = MagicMock()
        if name == "clients":
            tbl.select.return_value = make_chain([client_row])
        elif name == "call_logs":
            call_count[0] += 1
            if call_count[0] == 1:
                # calls_this_month
                tbl.select.return_value = make_chain(call_rows)
            else:
                # last_call_at
                tbl.select.return_value = make_chain(last_call)
        elif name == "bookings":
            tbl.select.return_value = make_chain(booking_rows)
        return tbl

    sb.table.side_effect = table_side_effect

    with patch("backend.routers.admin.get_supabase", return_value=sb):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/admin/clients", headers=AUTH)

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    client_stat = data[0]
    assert client_stat["calls_this_month"] == 2
    assert client_stat["bookings_this_month"] == 1
    # Cost: $5 base + 2 * 0.15 + 1 * 0.05 = 5.35
    assert abs(client_stat["monthly_cost_estimate"] - 5.35) < 0.01


# ---------------------------------------------------------------------------
# test_suspend_client_sets_is_active_false
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_suspend_client_sets_is_active_false():
    """PUT /api/admin/clients/{id}/status with is_active=false suspends client."""
    sb = MagicMock()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=[{"id": CLIENT_ID, "is_active": False}])
    chain.eq.return_value = chain
    sb.table.return_value.update.return_value = chain

    with patch("backend.routers.admin.get_supabase", return_value=sb):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.put(
                f"/api/admin/clients/{CLIENT_ID}/status",
                headers=AUTH,
                json={"is_active": False},
            )

    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


# ---------------------------------------------------------------------------
# test_reactivate_client_sets_is_active_true
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_reactivate_client_sets_is_active_true():
    """PUT /api/admin/clients/{id}/status with is_active=true reactivates client."""
    sb = MagicMock()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=[{"id": CLIENT_ID, "is_active": True}])
    chain.eq.return_value = chain
    sb.table.return_value.update.return_value = chain

    with patch("backend.routers.admin.get_supabase", return_value=sb):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.put(
                f"/api/admin/clients/{CLIENT_ID}/status",
                headers=AUTH,
                json={"is_active": True},
            )

    assert resp.status_code == 200
    assert resp.json()["is_active"] is True
