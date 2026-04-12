"""
APScheduler-based SMS automation for the AI Front-Desk Agent.

Three automated workflows:
  1. Appointment reminders  — sent 24 h before appointment, checked every 5 min.
  2. Post-job review requests — sent 2 h after appointment end, checked every 15 min.
  3. Missed-call recovery   — sent 2 min after a call ends without a booking,
                              checked every 2 min.

Design notes:
- All message bodies are pre-composed at queue-insert time (in tools.py /
  vapi_webhook.py) so the scheduler only needs to read → send → mark-sent.
- supabase-py is a synchronous client; every DB call is wrapped in
  asyncio.to_thread() to avoid blocking the event loop.
- SMS failures never raise — sms_service.send_sms() returns a dict.
- The scheduler is configured once via setup_scheduler() called from main.py.
"""

import asyncio
from datetime import datetime, timedelta, timezone

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI

from backend.db.client import get_supabase
from backend.services import sms_service
from backend.utils.logging import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _fetch_due_rows(reminder_type: str, window_minutes: int = 0) -> list[dict]:
    """Query reminders_queue for unsent rows of the given type that are due.

    Args:
        reminder_type: One of 'reminder', 'review_request', 'missed_call_recovery'.
        window_minutes: Look-ahead window added to now() for the scheduled_for
            cutoff.  Use 10 for reminders (fire up to 10 min early) and 0 for
            review requests / missed-call recovery (fire only when past-due).

    Returns:
        List of matching reminders_queue row dicts (may be empty).
    """
    now = datetime.now(timezone.utc)
    cutoff = (now + timedelta(minutes=window_minutes)).isoformat()

    def _query() -> list[dict]:
        supabase = get_supabase()
        result = (
            supabase.table("reminders_queue")
            .select("*")
            .eq("type", reminder_type)
            .eq("sent", False)
            .lte("scheduled_for", cutoff)
            .execute()
        )
        return result.data or []

    try:
        return await asyncio.to_thread(_query)
    except Exception as exc:
        logger.error(
            "reminders_queue fetch failed",
            reminder_type=reminder_type,
            error=str(exc),
        )
        return []


async def _mark_sent(reminder_id: str) -> None:
    """Mark a reminders_queue row as sent.

    Args:
        reminder_id: UUID of the reminders_queue row.
    """
    sent_at = datetime.now(timezone.utc).isoformat()

    def _update() -> None:
        supabase = get_supabase()
        supabase.table("reminders_queue").update(
            {"sent": True, "sent_at": sent_at}
        ).eq("id", reminder_id).execute()

    try:
        await asyncio.to_thread(_update)
    except Exception as exc:
        logger.error(
            "Failed to mark reminder sent",
            reminder_id=reminder_id,
            error=str(exc),
        )


async def _send_and_mark(row: dict) -> None:
    """Send a single SMS from a reminders_queue row and mark it sent on success.

    Args:
        row: A reminders_queue row dict.
    """
    reminder_id: str = row["id"]
    to_number: str = row["to_number"]
    message_body: str = row["message_body"]
    client_id: str = str(row["client_id"])
    reminder_type: str = row["type"]

    result = await asyncio.to_thread(
        lambda: sms_service.send_sms(to_number, message_body, client_id)
    )

    if result.get("success"):
        await _mark_sent(reminder_id)
        logger.info(
            "Scheduled SMS sent",
            type=reminder_type,
            reminder_id=reminder_id,
            to=to_number,
        )
    else:
        logger.error(
            "Scheduled SMS failed",
            type=reminder_type,
            reminder_id=reminder_id,
            error=result.get("error"),
        )


# ---------------------------------------------------------------------------
# Scheduler jobs
# ---------------------------------------------------------------------------


async def process_reminders() -> None:
    """Send appointment reminder SMS messages that are due within 10 minutes.

    Runs every 5 minutes.  Handles rows with type='reminder'.
    Message is pre-composed at booking time:
    "Reminder: {business_name} appointment tomorrow at {time}.
     Address confirmation: {address}. Questions? Reply here."
    """
    rows = await _fetch_due_rows("reminder", window_minutes=10)
    if not rows:
        return

    logger.info("Processing appointment reminders", count=len(rows))
    for row in rows:
        await _send_and_mark(row)


async def process_review_requests() -> None:
    """Send post-job review request SMS messages that are due.

    Runs every 15 minutes.  Handles rows with type='review_request'.
    Message is pre-composed at booking time:
    "Hi {name}! Hope {business_name} took great care of you today.
     Mind leaving a quick review? …"
    """
    rows = await _fetch_due_rows("review_request", window_minutes=0)
    if not rows:
        return

    logger.info("Processing review requests", count=len(rows))
    for row in rows:
        await _send_and_mark(row)


async def process_missed_call_recovery() -> None:
    """Send missed-call recovery SMS messages that are due.

    Runs every 2 minutes.  Handles rows with type='missed_call_recovery'.
    Message is pre-composed in vapi_webhook.py at call-end time:
    "Hi! We missed your call at {business_name}. Still need help? …"
    """
    rows = await _fetch_due_rows("missed_call_recovery", window_minutes=0)
    if not rows:
        return

    logger.info("Processing missed-call recovery", count=len(rows))
    for row in rows:
        await _send_and_mark(row)


# ---------------------------------------------------------------------------
# Scheduler setup
# ---------------------------------------------------------------------------


def setup_scheduler(app: FastAPI) -> AsyncIOScheduler:
    """Configure the APScheduler instance with all three SMS jobs.

    Stores the scheduler on ``app.state.scheduler`` so the lifespan handler
    in main.py can start and stop it cleanly.

    Job schedule:
      - process_reminders       → every 5 minutes
      - process_review_requests → every 15 minutes
      - process_missed_call_recovery → every 2 minutes

    Args:
        app: The FastAPI application instance.

    Returns:
        The configured (not yet started) AsyncIOScheduler.
    """
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        process_reminders,
        "interval",
        minutes=5,
        id="reminders",
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        process_review_requests,
        "interval",
        minutes=15,
        id="review_requests",
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        process_missed_call_recovery,
        "interval",
        minutes=2,
        id="missed_call_recovery",
        max_instances=1,
        coalesce=True,
    )

    app.state.scheduler = scheduler
    return scheduler
