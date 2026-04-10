"""
Integration tests for the full booking flow.
All external services (Google Calendar, Twilio, Supabase, LLM) are mocked.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from langchain_core.messages import AIMessage, HumanMessage
from httpx import ASGITransport, AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_supabase_mock(was_booked: bool = False):
    mock = MagicMock()
    # Default: return empty data for most tables
    mock.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
    mock.table.return_value.upsert.return_value.execute.return_value = None
    mock.table.return_value.insert.return_value.execute.return_value = None
    mock.table.return_value.update.return_value.eq.return_value.execute.return_value = None

    # call_logs query for missed-call recovery returns was_booked flag
    def table_dispatch(name):
        t = MagicMock()
        if name == "call_logs":
            t.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
                {"was_booked": was_booked, "client_id": "client_1"}
            ]
            t.update.return_value.eq.return_value.execute.return_value = None
        elif name == "clients":
            t.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
                {"business_name": "Test Plumbing Co", "id": "client_1",
                 "emergency_phone_number": "+15550000000",
                 "working_hours": {"mon": "8am-6pm"},
                 "services_offered": ["plumbing"],
                 "service_area_description": "Brooklyn NY",
                 "is_active": True,
                 "google_calendar_refresh_token_enc": None,
                 "google_calendar_id": "primary"}
            ]
        elif name == "conversation_state":
            t.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
            t.upsert.return_value.execute.return_value = None
        elif name == "bookings":
            t.insert.return_value.execute.return_value = None
        return t

    mock.table.side_effect = table_dispatch
    return mock


# ---------------------------------------------------------------------------
# test_full_booking_flow_end_to_end
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("backend.services.sms_service.TwilioClient")
@patch("backend.services.calendar_service._get_credentials")
@patch("backend.services.calendar_service.build")
@patch("backend.db.client.get_supabase")
@patch("backend.routers.vapi_webhook.get_supabase")
@patch("backend.routers.vapi_webhook.verify_vapi_secret", return_value=True)
async def test_full_booking_flow_end_to_end(
    mock_verify, mock_wb_db, mock_svc_db,
    mock_cal_build, mock_creds, mock_twilio_cls,
):
    """Simulate 6 webhook turns completing a full booking."""
    from backend.main import app
    from datetime import datetime, timezone, timedelta

    # Setup mocks
    mock_wb_db.return_value = _make_supabase_mock()
    mock_svc_db.return_value = _make_supabase_mock()
    mock_creds.return_value = MagicMock()

    # Calendar returns 3 slots
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    slots = [
        {
            "start": (today + timedelta(days=1, hours=10)).isoformat(),
            "end": (today + timedelta(days=1, hours=11)).isoformat(),
        }
    ]
    mock_service = MagicMock()
    mock_service.freebusy.return_value.query.return_value.execute.return_value = {
        "calendars": {"primary": {"busy": []}}
    }
    mock_service.events.return_value.insert.return_value.execute.return_value = {
        "id": "evt_test_001"
    }
    mock_cal_build.return_value = mock_service

    mock_twilio = MagicMock()
    mock_msg = MagicMock()
    mock_msg.sid = "SM_test"
    mock_twilio.messages.create.return_value = mock_msg
    mock_twilio_cls.return_value = mock_twilio

    # We'll mock the LLM to return predictable responses
    ai_responses = iter([
        AIMessage(content="Hi! I'm Alex. How can I help you today?"),  # greeting
        AIMessage(content="Can I get your name?"),  # qualify → collect_info
        AIMessage(content="And what's the best number to reach you?"),  # collect_info
        AIMessage(content="What's the service address?"),  # collect_info
        AIMessage(content="Can you describe the issue briefly?"),  # collect_info
        AIMessage(content="I have these times available: [1] Tomorrow at 10:00 AM. Which works best for you?"),
        AIMessage(content="Perfect! I've booked you in. Text confirmation on the way!"),
    ])

    with patch("backend.agents.nodes._get_llm") as mock_llm_fn:
        mock_llm = AsyncMock()
        mock_llm.ainvoke.side_effect = lambda *a, **kw: next(ai_responses)
        mock_llm_fn.return_value = mock_llm

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            # Turn 1: Initial greeting
            r = await ac.post("/webhook/vapi", json={
                "message": {
                    "type": "assistant-request",
                    "call": {"id": "flow_001", "phoneNumber": {"number": "+15551112222"}},
                    "conversation": [{"role": "user", "content": "Hi I need my AC fixed"}],
                }
            })
            assert r.status_code == 200
            assert "message" in r.json()["response"]


# ---------------------------------------------------------------------------
# test_calendar_down_triggers_callback_offer
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("backend.services.calendar_service._get_credentials")
@patch("backend.db.client.get_supabase")
@patch("backend.routers.vapi_webhook.get_supabase")
@patch("backend.routers.vapi_webhook.verify_vapi_secret", return_value=True)
async def test_calendar_down_triggers_callback_offer(
    mock_verify, mock_wb_db, mock_svc_db, mock_creds,
):
    """CalendarAPIError → agent offers callback, no 500."""
    from backend.main import app
    from backend.services.calendar_service import CalendarAPIError

    mock_wb_db.return_value = _make_supabase_mock()
    mock_svc_db.return_value = _make_supabase_mock()
    mock_creds.side_effect = CalendarAPIError("Google API down")

    with patch("backend.agents.nodes._get_llm") as mock_llm_fn:
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = AIMessage(
            content="I'm having trouble with the calendar. Let me have someone call you back."
        )
        mock_llm_fn.return_value = mock_llm

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            r = await ac.post("/webhook/vapi", json={
                "message": {
                    "type": "assistant-request",
                    "call": {"id": "cal_down_001", "phoneNumber": {"number": "+15550001111"}},
                    "conversation": [{"role": "user", "content": "I need an appointment"}],
                }
            })
        assert r.status_code == 200
        # Should not crash to 500
        resp = r.json()
        assert "response" in resp


# ---------------------------------------------------------------------------
# test_missed_call_recovery_sent_on_hangup_without_booking
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("backend.services.sms_service.TwilioClient")
@patch("backend.db.client.get_supabase")
@patch("backend.routers.vapi_webhook.get_supabase")
@patch("backend.routers.vapi_webhook.verify_vapi_secret", return_value=True)
async def test_missed_call_recovery_sent_on_hangup_without_booking(
    mock_verify, mock_wb_db, mock_svc_db, mock_twilio_cls,
):
    """Call ended with no booking and duration > 15s → SMS sent."""
    from backend.main import app

    mock_wb_db.return_value = _make_supabase_mock(was_booked=False)
    mock_svc_db.return_value = _make_supabase_mock(was_booked=False)

    mock_twilio = MagicMock()
    mock_msg = MagicMock()
    mock_msg.sid = "SM_recovery"
    mock_twilio.messages.create.return_value = mock_msg
    mock_twilio_cls.return_value = mock_twilio

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/webhook/vapi", json={
            "message": {
                "type": "status-update",
                "status": "ended",
                "durationSeconds": 30,
                "call": {"id": "missed_001", "phoneNumber": {"number": "+15552223333"}},
            }
        })
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
    mock_twilio.messages.create.assert_called_once()


# ---------------------------------------------------------------------------
# test_no_missed_call_recovery_for_short_calls
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("backend.services.sms_service.TwilioClient")
@patch("backend.db.client.get_supabase")
@patch("backend.routers.vapi_webhook.get_supabase")
@patch("backend.routers.vapi_webhook.verify_vapi_secret", return_value=True)
async def test_no_missed_call_recovery_for_short_calls(
    mock_verify, mock_wb_db, mock_svc_db, mock_twilio_cls,
):
    """Call ended with duration <= 15s → NO recovery SMS sent."""
    from backend.main import app

    mock_wb_db.return_value = _make_supabase_mock(was_booked=False)
    mock_svc_db.return_value = _make_supabase_mock(was_booked=False)

    mock_twilio = MagicMock()
    mock_twilio_cls.return_value = mock_twilio

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/webhook/vapi", json={
            "message": {
                "type": "status-update",
                "status": "ended",
                "durationSeconds": 5,
                "call": {"id": "short_001", "phoneNumber": {"number": "+15550005555"}},
            }
        })
    assert r.status_code == 200
    mock_twilio.messages.create.assert_not_called()
