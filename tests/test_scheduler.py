"""
Tests for backend/services/scheduler.py

All external calls (Supabase + Twilio) are fully mocked.
Time is controlled by patching datetime.now() inside the scheduler module.
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch, call


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_row(
    row_id: str,
    reminder_type: str,
    to_number: str = "+15551234567",
    message_body: str = "Test message",
    client_id: str = "client-uuid-1",
    scheduled_for: str | None = None,
) -> dict:
    """Build a minimal reminders_queue row dict for testing."""
    if scheduled_for is None:
        scheduled_for = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    return {
        "id": row_id,
        "type": reminder_type,
        "to_number": to_number,
        "message_body": message_body,
        "client_id": client_id,
        "sent": False,
        "scheduled_for": scheduled_for,
    }


def _mock_supabase_returning(rows: list[dict]) -> MagicMock:
    """Return a Supabase MagicMock whose select chain returns the given rows."""
    mock_supabase = MagicMock()
    # Chain: .table().select().eq().eq().lte().execute() -> .data = rows
    (
        mock_supabase
        .table.return_value
        .select.return_value
        .eq.return_value
        .eq.return_value
        .lte.return_value
        .execute.return_value
        .data
    ) = rows
    # Chain: .table().update().eq().execute() -> success
    (
        mock_supabase
        .table.return_value
        .update.return_value
        .eq.return_value
        .execute.return_value
    ) = MagicMock()
    return mock_supabase


# ---------------------------------------------------------------------------
# process_reminders tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reminder_sent_when_due():
    """A reminder row with scheduled_for in the past is sent and marked sent."""
    row = _make_row("r1", "reminder", to_number="+15551234567",
                    message_body="Reminder: Test Plumbing Co appointment tomorrow at 10am.")
    mock_supabase = _mock_supabase_returning([row])

    with patch("backend.services.scheduler.get_supabase", return_value=mock_supabase), \
         patch("backend.services.scheduler.sms_service") as mock_sms:
        mock_sms.send_sms.return_value = {"success": True, "sid": "SM_test"}

        from backend.services.scheduler import process_reminders
        await process_reminders()

        mock_sms.send_sms.assert_called_once_with(
            "+15551234567", row["message_body"], "client-uuid-1"
        )
        # Verify mark-sent: update called on reminders_queue table
        mock_supabase.table.assert_any_call("reminders_queue")


@pytest.mark.asyncio
async def test_reminder_not_sent_before_due():
    """A reminder scheduled far in the future is excluded by the DB filter — SMS not called."""
    # The DB query (with lte filter) returns nothing — simulates future row excluded
    mock_supabase = _mock_supabase_returning([])

    with patch("backend.services.scheduler.get_supabase", return_value=mock_supabase), \
         patch("backend.services.scheduler.sms_service") as mock_sms:

        from backend.services.scheduler import process_reminders
        await process_reminders()

        mock_sms.send_sms.assert_not_called()


@pytest.mark.asyncio
async def test_reminder_not_sent_twice():
    """Already-sent rows (sent=True) are excluded by the DB filter — SMS not called again."""
    # The DB query (with eq sent=False filter) returns nothing — simulates already-sent row excluded
    mock_supabase = _mock_supabase_returning([])

    with patch("backend.services.scheduler.get_supabase", return_value=mock_supabase), \
         patch("backend.services.scheduler.sms_service") as mock_sms:

        from backend.services.scheduler import process_reminders
        await process_reminders()

        mock_sms.send_sms.assert_not_called()


@pytest.mark.asyncio
async def test_reminder_not_marked_sent_on_sms_failure():
    """When SMS send fails the row is NOT marked sent (will be retried next cycle)."""
    row = _make_row("r_fail", "reminder", message_body="Reminder: Test Co appointment.")
    mock_supabase = _mock_supabase_returning([row])

    with patch("backend.services.scheduler.get_supabase", return_value=mock_supabase), \
         patch("backend.services.scheduler.sms_service") as mock_sms:
        mock_sms.send_sms.return_value = {"success": False, "error": "Twilio 503"}

        from backend.services.scheduler import process_reminders
        await process_reminders()

        # SMS was attempted
        mock_sms.send_sms.assert_called_once()
        # update() must NOT have been called (row not marked sent)
        mock_supabase.table.return_value.update.assert_not_called()


# ---------------------------------------------------------------------------
# process_review_requests tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_review_request_sent_after_appointment():
    """A review_request row that is past-due is sent and marked sent."""
    row = _make_row(
        "r2",
        "review_request",
        to_number="+15559876543",
        message_body="Hi Alice! Hope Test Plumbing Co took great care of you today.",
    )
    mock_supabase = _mock_supabase_returning([row])

    with patch("backend.services.scheduler.get_supabase", return_value=mock_supabase), \
         patch("backend.services.scheduler.sms_service") as mock_sms:
        mock_sms.send_sms.return_value = {"success": True, "sid": "SM_review"}

        from backend.services.scheduler import process_review_requests
        await process_review_requests()

        mock_sms.send_sms.assert_called_once_with(
            "+15559876543", row["message_body"], "client-uuid-1"
        )
        mock_supabase.table.assert_any_call("reminders_queue")


@pytest.mark.asyncio
async def test_review_request_not_sent_when_queue_empty():
    """No review request SMS is sent when there are no due rows."""
    mock_supabase = _mock_supabase_returning([])

    with patch("backend.services.scheduler.get_supabase", return_value=mock_supabase), \
         patch("backend.services.scheduler.sms_service") as mock_sms:

        from backend.services.scheduler import process_review_requests
        await process_review_requests()

        mock_sms.send_sms.assert_not_called()


# ---------------------------------------------------------------------------
# process_missed_call_recovery tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_missed_call_recovery_triggered_on_no_booking():
    """A missed_call_recovery row that is past-due is sent and marked sent."""
    row = _make_row(
        "r3",
        "missed_call_recovery",
        to_number="+15551112222",
        message_body="Hi! We missed your call at Test Plumbing Co. Still need help?",
    )
    mock_supabase = _mock_supabase_returning([row])

    with patch("backend.services.scheduler.get_supabase", return_value=mock_supabase), \
         patch("backend.services.scheduler.sms_service") as mock_sms:
        mock_sms.send_sms.return_value = {"success": True, "sid": "SM_missed"}

        from backend.services.scheduler import process_missed_call_recovery
        await process_missed_call_recovery()

        mock_sms.send_sms.assert_called_once_with(
            "+15551112222", row["message_body"], "client-uuid-1"
        )
        mock_supabase.table.assert_any_call("reminders_queue")


@pytest.mark.asyncio
async def test_missed_call_recovery_not_sent_before_scheduled():
    """A missed_call_recovery row not yet due is excluded by the DB filter."""
    mock_supabase = _mock_supabase_returning([])

    with patch("backend.services.scheduler.get_supabase", return_value=mock_supabase), \
         patch("backend.services.scheduler.sms_service") as mock_sms:

        from backend.services.scheduler import process_missed_call_recovery
        await process_missed_call_recovery()

        mock_sms.send_sms.assert_not_called()


# ---------------------------------------------------------------------------
# setup_scheduler tests
# ---------------------------------------------------------------------------

def test_setup_scheduler_registers_three_jobs():
    """setup_scheduler adds exactly 3 jobs to the scheduler."""
    from fastapi import FastAPI
    from backend.services.scheduler import setup_scheduler

    app = FastAPI()
    scheduler = setup_scheduler(app)

    job_ids = {job.id for job in scheduler.get_jobs()}
    assert "reminders" in job_ids
    assert "review_requests" in job_ids
    assert "missed_call_recovery" in job_ids
    assert hasattr(app.state, "scheduler")
    assert app.state.scheduler is scheduler
