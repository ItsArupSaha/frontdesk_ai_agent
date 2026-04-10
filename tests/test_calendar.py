"""Tests for backend/services/calendar_service.py — all Google API calls mocked."""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_slot_dt(hour: int, date: datetime | None = None) -> str:
    """Return an ISO datetime string for a given hour today (UTC)."""
    base = date or datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return (base + timedelta(hours=hour)).isoformat()


def _patch_db_client(working_hours=None, calendar_id="primary", has_refresh_token=True):
    """Return a mock Supabase client configured for calendar tests."""
    wh = working_hours or {"mon": "8am-6pm", "tue": "8am-6pm", "wed": "8am-6pm",
                           "thu": "8am-6pm", "fri": "8am-6pm", "sat": "9am-2pm",
                           "sun": "closed"}
    client_row = {
        "google_calendar_refresh_token_enc": "enc_token" if has_refresh_token else None,
        "google_calendar_id": calendar_id,
        "working_hours": wh,
    }
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [client_row]
    return mock_supabase


# ---------------------------------------------------------------------------
# get_available_slots tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("backend.services.calendar_service.get_supabase")
@patch("backend.services.calendar_service._get_credentials")
@patch("backend.services.calendar_service.build")
async def test_get_available_slots_returns_max_3_slots(mock_build, mock_creds, mock_db):
    from backend.services.calendar_service import get_available_slots

    mock_db.return_value = _patch_db_client()
    mock_creds.return_value = MagicMock()

    mock_service = MagicMock()
    mock_service.freebusy.return_value.query.return_value.execute.return_value = {
        "calendars": {"primary": {"busy": []}}
    }
    mock_build.return_value = mock_service

    slots = await get_available_slots("client_1", "this week")
    assert len(slots) <= 3


@pytest.mark.asyncio
@patch("backend.services.calendar_service.get_supabase")
@patch("backend.services.calendar_service._get_credentials")
@patch("backend.services.calendar_service.build")
async def test_get_available_slots_respects_working_hours(mock_build, mock_creds, mock_db):
    """Slots outside working hours (e.g. 11pm) must not appear."""
    from backend.services.calendar_service import get_available_slots

    mock_db.return_value = _patch_db_client(working_hours={"mon": "8am-5pm"})
    mock_creds.return_value = MagicMock()

    mock_service = MagicMock()
    mock_service.freebusy.return_value.query.return_value.execute.return_value = {
        "calendars": {"primary": {"busy": []}}
    }
    mock_build.return_value = mock_service

    slots = await get_available_slots("client_1", "monday")
    for slot in slots:
        start_hour = datetime.fromisoformat(slot["start"]).hour
        assert 8 <= start_hour < 17, f"Slot at hour {start_hour} is outside working hours"


@pytest.mark.asyncio
@patch("backend.services.calendar_service.get_supabase")
@patch("backend.services.calendar_service._get_credentials")
@patch("backend.services.calendar_service.build")
async def test_get_available_slots_skips_busy_periods(mock_build, mock_creds, mock_db):
    """A 10am-11am busy period must prevent offering a 10am slot."""
    from backend.services.calendar_service import get_available_slots

    # Next Monday
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    days_until_monday = (7 - today.weekday()) % 7 or 7
    monday = today + timedelta(days=days_until_monday)

    busy_start = (monday + timedelta(hours=10)).isoformat()
    busy_end = (monday + timedelta(hours=11)).isoformat()

    mock_db.return_value = _patch_db_client(working_hours={"mon": "8am-6pm"})
    mock_creds.return_value = MagicMock()

    mock_service = MagicMock()
    mock_service.freebusy.return_value.query.return_value.execute.return_value = {
        "calendars": {"primary": {"busy": [{"start": busy_start, "end": busy_end}]}}
    }
    mock_build.return_value = mock_service

    slots = await get_available_slots("client_1", "monday")
    for slot in slots:
        slot_start = datetime.fromisoformat(slot["start"])
        # The 10am slot should not appear
        assert slot_start.hour != 10, "Busy 10am slot should not be offered"


@pytest.mark.asyncio
@patch("backend.services.calendar_service.get_supabase")
@patch("backend.services.calendar_service._get_credentials")
@patch("backend.services.calendar_service.build")
async def test_get_available_slots_returns_empty_list_when_fully_booked(
    mock_build, mock_creds, mock_db
):
    """Fully booked calendar returns []."""
    from backend.services.calendar_service import get_available_slots

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    # Mark entire day as busy
    busy = [{"start": (today + timedelta(hours=0)).isoformat(),
             "end": (today + timedelta(hours=24)).isoformat()}]

    mock_db.return_value = _patch_db_client()
    mock_creds.return_value = MagicMock()
    mock_service = MagicMock()
    mock_service.freebusy.return_value.query.return_value.execute.return_value = {
        "calendars": {"primary": {"busy": busy}}
    }
    mock_build.return_value = mock_service

    slots = await get_available_slots("client_1", "today")
    assert slots == []


# ---------------------------------------------------------------------------
# book_appointment tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("backend.services.calendar_service.get_supabase")
@patch("backend.services.calendar_service._get_credentials")
@patch("backend.services.calendar_service.build")
async def test_book_appointment_creates_calendar_event(mock_build, mock_creds, mock_db):
    from backend.services.calendar_service import book_appointment

    mock_db.return_value = _patch_db_client()
    mock_creds.return_value = MagicMock()

    mock_event = {"id": "evt_123", "summary": "John — leaky faucet"}
    mock_service = MagicMock()
    mock_service.events.return_value.insert.return_value.execute.return_value = mock_event
    mock_build.return_value = mock_service

    slot = {
        "start": "2024-06-10T10:00:00+00:00",
        "end": "2024-06-10T11:00:00+00:00",
        "label": "Monday June 10 at 10:00 AM",
    }
    caller_details = {
        "name": "John Smith",
        "phone": "+15551234567",
        "address": "123 Main St",
        "problem_description": "leaky faucet",
    }
    result = await book_appointment("client_1", slot, caller_details)
    assert result["id"] == "evt_123"
    mock_service.events.return_value.insert.assert_called_once()


@pytest.mark.asyncio
@patch("backend.services.calendar_service.get_supabase")
@patch("backend.services.calendar_service._get_credentials")
@patch("backend.services.calendar_service.build")
async def test_book_appointment_returns_event_with_id(mock_build, mock_creds, mock_db):
    from backend.services.calendar_service import book_appointment

    mock_db.return_value = _patch_db_client()
    mock_creds.return_value = MagicMock()

    mock_service = MagicMock()
    mock_service.events.return_value.insert.return_value.execute.return_value = {
        "id": "abc_event_id"
    }
    mock_build.return_value = mock_service

    result = await book_appointment(
        "client_1",
        {"start": "2024-06-10T09:00:00+00:00", "end": "2024-06-10T10:00:00+00:00"},
        {"name": "Jane", "phone": "+15550001111", "address": "456 Oak Ave",
         "problem_description": "AC not cooling"},
    )
    assert result.get("id") == "abc_event_id"


@pytest.mark.asyncio
@patch("backend.services.calendar_service.get_supabase")
@patch("backend.services.calendar_service._get_credentials")
@patch("backend.services.calendar_service.build")
async def test_book_appointment_raises_on_google_api_error(mock_build, mock_creds, mock_db):
    from googleapiclient.errors import HttpError
    from backend.services.calendar_service import book_appointment, CalendarBookingError

    mock_db.return_value = _patch_db_client()
    mock_creds.return_value = MagicMock()

    mock_service = MagicMock()
    mock_service.events.return_value.insert.return_value.execute.side_effect = HttpError(
        MagicMock(status=500), b"Server Error"
    )
    mock_build.return_value = mock_service

    with pytest.raises(CalendarBookingError):
        await book_appointment(
            "client_1",
            {"start": "2024-06-10T09:00:00+00:00", "end": "2024-06-10T10:00:00+00:00"},
            {"name": "Bob", "phone": "+15550002222", "address": "789 Elm St",
             "problem_description": "furnace broken"},
        )


@patch("backend.services.calendar_service.get_supabase")
def test_calendar_not_connected_raises_correct_error(mock_db):
    from backend.services.calendar_service import _get_credentials, CalendarNotConnectedError

    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"google_calendar_refresh_token_enc": None, "google_calendar_id": "primary"}
    ]
    mock_db.return_value = mock_supabase

    with pytest.raises(CalendarNotConnectedError):
        _get_credentials("client_no_calendar")


@pytest.mark.asyncio
@patch("backend.services.calendar_service.get_supabase")
@patch("backend.services.calendar_service._get_credentials")
async def test_handle_oauth_callback_stores_encrypted_token(mock_creds, mock_db):
    from backend.services.calendar_service import handle_oauth_callback
    from backend.utils.encryption import decrypt

    mock_creds.return_value = MagicMock()

    # Track what gets upserted
    stored = {}
    mock_supabase = MagicMock()
    def capture_update(data):
        stored.update(data)
        m = MagicMock()
        m.eq.return_value.execute.return_value = None
        return m
    mock_supabase.table.return_value.update.side_effect = capture_update
    mock_db.return_value = mock_supabase

    with patch("backend.services.calendar_service._build_flow") as mock_flow_fn:
        mock_flow = MagicMock()
        mock_flow.credentials.refresh_token = "real_refresh_token_xyz"
        mock_flow_fn.return_value = mock_flow

        await handle_oauth_callback("auth_code_123", "client_abc")

    assert "google_calendar_refresh_token_enc" in stored
    assert stored["google_calendar_refresh_token_enc"] != "real_refresh_token_xyz"
    # Verify we can decrypt it back
    assert decrypt(stored["google_calendar_refresh_token_enc"]) == "real_refresh_token_xyz"


@pytest.mark.asyncio
async def test_handle_oauth_callback_raises_if_no_refresh_token():
    from backend.services.calendar_service import handle_oauth_callback, CalendarAuthError

    with patch("backend.services.calendar_service._build_flow") as mock_flow_fn:
        mock_flow = MagicMock()
        mock_flow.credentials.refresh_token = None  # Google didn't return a refresh token
        mock_flow_fn.return_value = mock_flow

        with pytest.raises(CalendarAuthError):
            await handle_oauth_callback("code", "client_1")
