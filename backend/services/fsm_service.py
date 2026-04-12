"""
Unified FSM (Field Service Management) sync service.

Routes booking data to either Jobber or Housecall Pro based on per-client
configuration. Designed to run as a FastAPI BackgroundTask — callers do not
await the result and it never raises.

Retry strategy: 3 attempts with 5-second backoff. After all retries exhausted
a CRITICAL log is emitted so Arup is alerted.
"""
import asyncio

import structlog

from backend.db.models import Booking
from backend.services import jobber_service, housecall_service

logger = structlog.get_logger(__name__)

_MAX_RETRIES = 3
_RETRY_DELAY_SECONDS = 5.0


# ---------------------------------------------------------------------------
# Retry helper
# ---------------------------------------------------------------------------


async def _call_with_retry(
    coro_factory,
    booking: Booking,
    label: str,
) -> dict | None:
    """Call an async coroutine factory up to _MAX_RETRIES times.

    Args:
        coro_factory: Zero-arg callable that returns a coroutine to execute.
        booking: Booking model (used for logging context only).
        label: Human-readable label for the FSM type (e.g. "jobber").

    Returns:
        Result dict from the coroutine on first success, or None after all
        retries are exhausted.
    """
    last_result = None
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            result = await coro_factory()
        except Exception as exc:
            logger.error(
                "FSM sync attempt raised unexpected exception",
                fsm=label,
                attempt=attempt,
                error=str(exc),
                booking_id=str(booking.id),
            )
            result = None

        if result is not None:
            return result
        if attempt < _MAX_RETRIES:
            logger.warning(
                "FSM sync attempt failed, retrying",
                fsm=label,
                attempt=attempt,
                booking_id=str(booking.id),
            )
            await asyncio.sleep(_RETRY_DELAY_SECONDS)
        last_result = result

    logger.critical(
        "FSM sync failed after all retries",
        fsm=label,
        attempts=_MAX_RETRIES,
        booking_id=str(booking.id),
    )
    return last_result


# ---------------------------------------------------------------------------
# DB helper (update fsm_synced on the booking row)
# ---------------------------------------------------------------------------


def _update_booking_fsm_status(
    booking: Booking,
    fsm_record_id: str | None,
    error: str | None,
) -> None:
    """Update the booking row in Supabase with FSM sync outcome.

    Failures here are logged but do not propagate — the primary booking
    record already exists and is correct.

    Args:
        booking: Booking whose DB row should be updated.
        fsm_record_id: Composite ID string from FSM (e.g. "req_xxx") or None.
        error: Error message to store when sync failed.
    """
    if booking.id is None:
        return
    try:
        from backend.db.client import get_supabase
        supabase = get_supabase()
        update_payload: dict = {
            "fsm_synced": fsm_record_id is not None,
            "fsm_record_id": fsm_record_id,
            "fsm_sync_error": error,
        }
        supabase.table("bookings").update(update_payload).eq(
            "id", str(booking.id)
        ).execute()
    except Exception as exc:
        logger.error(
            "Failed to update booking fsm_synced column",
            error=str(exc),
            booking_id=str(booking.id),
        )


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------


async def sync_booking_to_fsm(
    booking: Booking,
    client_config: dict,
) -> None:
    """Sync a confirmed booking to the client's FSM platform.

    Reads ``fsm_type`` from client_config and dispatches to the appropriate
    integration. Runs retry logic, then writes the outcome back to the
    bookings table.

    This function is fire-and-forget — it never raises. Designed to be
    launched as a FastAPI BackgroundTask.

    Args:
        booking: The confirmed Booking to sync.
        client_config: Per-client config dict. Expected keys:
            - fsm_type: "jobber" | "housecallpro" | None
            - jobber_api_key: str (required when fsm_type == "jobber")
            - housecall_pro_api_key: str (required when fsm_type == "housecallpro")
    """
    fsm_type: str | None = client_config.get("fsm_type")

    if not fsm_type:
        logger.debug("FSM sync skipped — no fsm_type configured", booking_id=str(booking.id))
        return

    result: dict | None = None

    if fsm_type == "jobber":
        jobber_api_key: str = client_config.get("jobber_api_key", "")
        result = await _call_with_retry(
            lambda: jobber_service.create_client_and_request(booking, jobber_api_key),
            booking,
            label="jobber",
        )
        if result:
            record_id = f"client:{result['client_id']},request:{result['request_id']}"
        else:
            record_id = None

    elif fsm_type == "housecallpro":
        hcp_api_key: str = client_config.get("housecall_pro_api_key", "")
        result = await _call_with_retry(
            lambda: housecall_service.create_customer_and_job(booking, hcp_api_key),
            booking,
            label="housecallpro",
        )
        if result:
            record_id = f"customer:{result['customer_id']},job:{result['job_id']}"
        else:
            record_id = None

    else:
        logger.warning(
            "Unknown fsm_type — sync skipped",
            fsm_type=fsm_type,
            booking_id=str(booking.id),
        )
        return

    error_msg = None if result is not None else f"All {_MAX_RETRIES} sync attempts failed"
    _update_booking_fsm_status(booking, record_id, error_msg)
