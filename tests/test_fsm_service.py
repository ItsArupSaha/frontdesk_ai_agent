"""Tests for backend/services/fsm_service.py — all external calls mocked."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call
from datetime import datetime

from backend.db.models import Booking


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def make_booking(**overrides) -> Booking:
    """Return a minimal Booking for FSM service tests."""
    defaults = dict(
        id="booking_test_123",
        client_id="client_test",
        caller_name="Carol White",
        caller_phone="+15550009876",
        caller_address="789 Elm St",
        problem_description="Dripping faucet",
        appointment_start=datetime(2026, 4, 22, 9, 0),
        appointment_end=datetime(2026, 4, 22, 10, 0),
    )
    defaults.update(overrides)
    return Booking(**defaults)


def make_config(**overrides) -> dict:
    """Return a minimal client config dict."""
    defaults = {
        "id": "client_test",
        "fsm_type": None,
        "jobber_api_key": "",
        "housecall_pro_api_key": "",
    }
    defaults.update(overrides)
    return defaults


# ---------------------------------------------------------------------------
# test_routes_to_jobber_when_fsm_type_is_jobber
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("backend.services.fsm_service._update_booking_fsm_status")
@patch("backend.services.fsm_service.jobber_service.create_client_and_request", new_callable=AsyncMock)
async def test_routes_to_jobber_when_fsm_type_is_jobber(mock_jobber, mock_update):
    """When fsm_type is 'jobber', jobber_service is called and HCP is not."""
    from backend.services.fsm_service import sync_booking_to_fsm

    mock_jobber.return_value = {"client_id": "j_client", "request_id": "j_req"}

    booking = make_booking()
    config = make_config(fsm_type="jobber", jobber_api_key="key_j")

    await sync_booking_to_fsm(booking, config)

    mock_jobber.assert_called_once_with(booking, "key_j")
    mock_update.assert_called_once()
    # record_id should encode both IDs
    args = mock_update.call_args.args
    assert "j_client" in args[1]
    assert "j_req" in args[1]
    assert args[2] is None  # no error


# ---------------------------------------------------------------------------
# test_routes_to_hcp_when_fsm_type_is_housecallpro
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("backend.services.fsm_service._update_booking_fsm_status")
@patch("backend.services.fsm_service.housecall_service.create_customer_and_job", new_callable=AsyncMock)
async def test_routes_to_hcp_when_fsm_type_is_housecallpro(mock_hcp, mock_update):
    """When fsm_type is 'housecallpro', HCP service is called and Jobber is not."""
    from backend.services.fsm_service import sync_booking_to_fsm

    mock_hcp.return_value = {"customer_id": "hcp_cust", "job_id": "hcp_job"}

    booking = make_booking()
    config = make_config(fsm_type="housecallpro", housecall_pro_api_key="key_hcp")

    await sync_booking_to_fsm(booking, config)

    mock_hcp.assert_called_once_with(booking, "key_hcp")
    mock_update.assert_called_once()
    args = mock_update.call_args.args
    assert "hcp_cust" in args[1]
    assert "hcp_job" in args[1]
    assert args[2] is None  # no error


# ---------------------------------------------------------------------------
# test_skips_when_fsm_type_is_none
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("backend.services.fsm_service._update_booking_fsm_status")
@patch("backend.services.fsm_service.jobber_service.create_client_and_request", new_callable=AsyncMock)
@patch("backend.services.fsm_service.housecall_service.create_customer_and_job", new_callable=AsyncMock)
async def test_skips_when_fsm_type_is_none(mock_hcp, mock_jobber, mock_update):
    """When fsm_type is None, neither service is called and DB is not touched."""
    from backend.services.fsm_service import sync_booking_to_fsm

    booking = make_booking()
    config = make_config(fsm_type=None)

    await sync_booking_to_fsm(booking, config)

    mock_jobber.assert_not_called()
    mock_hcp.assert_not_called()
    mock_update.assert_not_called()


# ---------------------------------------------------------------------------
# test_retries_on_failure
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("backend.services.fsm_service._update_booking_fsm_status")
@patch("backend.services.fsm_service.asyncio.sleep", new_callable=AsyncMock)
@patch("backend.services.fsm_service.jobber_service.create_client_and_request", new_callable=AsyncMock)
async def test_retries_on_failure(mock_jobber, mock_sleep, mock_update):
    """Jobber returns None (failure) → retried 3 times with sleep between attempts."""
    from backend.services.fsm_service import sync_booking_to_fsm, _MAX_RETRIES, _RETRY_DELAY_SECONDS

    # All attempts fail
    mock_jobber.return_value = None

    booking = make_booking()
    config = make_config(fsm_type="jobber", jobber_api_key="key_j")

    await sync_booking_to_fsm(booking, config)

    assert mock_jobber.call_count == _MAX_RETRIES
    # sleep called between failures (N-1 times)
    assert mock_sleep.call_count == _MAX_RETRIES - 1
    mock_sleep.assert_called_with(_RETRY_DELAY_SECONDS)


@pytest.mark.asyncio
@patch("backend.services.fsm_service._update_booking_fsm_status")
@patch("backend.services.fsm_service.asyncio.sleep", new_callable=AsyncMock)
@patch("backend.services.fsm_service.jobber_service.create_client_and_request", new_callable=AsyncMock)
async def test_succeeds_on_second_retry(mock_jobber, mock_sleep, mock_update):
    """If the second attempt succeeds, no further retries are made."""
    from backend.services.fsm_service import sync_booking_to_fsm

    # First call fails, second succeeds
    mock_jobber.side_effect = [
        None,
        {"client_id": "j_ok", "request_id": "r_ok"},
    ]

    booking = make_booking()
    config = make_config(fsm_type="jobber", jobber_api_key="key_j")

    await sync_booking_to_fsm(booking, config)

    assert mock_jobber.call_count == 2
    assert mock_sleep.call_count == 1


@pytest.mark.asyncio
@patch("backend.services.fsm_service._update_booking_fsm_status")
@patch("backend.services.fsm_service.asyncio.sleep", new_callable=AsyncMock)
@patch("backend.services.fsm_service.jobber_service.create_client_and_request", new_callable=AsyncMock)
async def test_all_retries_fail_stores_error(mock_jobber, mock_sleep, mock_update):
    """After all retries exhausted, fsm_sync_error is stored in DB."""
    from backend.services.fsm_service import sync_booking_to_fsm

    mock_jobber.return_value = None

    booking = make_booking()
    config = make_config(fsm_type="jobber", jobber_api_key="key_j")

    await sync_booking_to_fsm(booking, config)

    mock_update.assert_called_once()
    args = mock_update.call_args.args
    assert args[1] is None   # no record_id
    assert args[2] is not None  # error message present


# ---------------------------------------------------------------------------
# test_fsm_never_raises
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("backend.services.fsm_service._update_booking_fsm_status")
@patch("backend.services.fsm_service.asyncio.sleep", new_callable=AsyncMock)
@patch("backend.services.fsm_service.jobber_service.create_client_and_request", new_callable=AsyncMock)
async def test_fsm_sync_never_raises_on_unexpected_exception(mock_jobber, mock_sleep, mock_update):
    """Even if an unexpected exception occurs, sync_booking_to_fsm must not raise."""
    from backend.services.fsm_service import sync_booking_to_fsm

    mock_jobber.side_effect = RuntimeError("completely unexpected")

    booking = make_booking()
    config = make_config(fsm_type="jobber", jobber_api_key="key_j")

    # Must not raise
    await sync_booking_to_fsm(booking, config)
