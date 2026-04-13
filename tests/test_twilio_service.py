"""
Tests for backend/services/twilio_service.py

Twilio client is fully mocked so no real account or credentials are needed.
"""
from __future__ import annotations

import pytest
from unittest.mock import MagicMock, patch, AsyncMock

from backend.services.twilio_service import (
    provision_number,
    release_number,
    TwilioProvisionError,
    FALLBACK_AREA_CODES,
)

CLIENT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_available(phone_number: str) -> MagicMock:
    """Return a mock object representing an available Twilio phone number."""
    m = MagicMock()
    m.phone_number = phone_number
    return m


def _mock_purchased(phone_number: str) -> MagicMock:
    """Return a mock object representing a purchased Twilio incoming number."""
    m = MagicMock()
    m.phone_number = phone_number
    return m


# ---------------------------------------------------------------------------
# provision_number tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_provision_number_in_requested_area_code():
    """Should purchase the first available number in the requested area code."""
    avail = _mock_available("+17185551234")
    purchased = _mock_purchased("+17185551234")

    with patch("backend.services.twilio_service._get_client") as mock_get_client:
        twilio = MagicMock()
        # Local search returns one number.
        twilio.available_phone_numbers.return_value.local.list.return_value = [avail]
        # Purchase succeeds.
        twilio.incoming_phone_numbers.create.return_value = purchased
        mock_get_client.return_value = twilio

        result = await provision_number("718", CLIENT_ID)

    assert result == "+17185551234"
    twilio.incoming_phone_numbers.create.assert_called_once()


@pytest.mark.asyncio
async def test_provision_number_falls_back_to_neighbor_area_code():
    """When requested area code has no numbers, should try fallback area codes."""
    avail_fallback = _mock_available("+19175559876")
    purchased = _mock_purchased("+19175559876")

    with patch("backend.services.twilio_service._get_client") as mock_get_client:
        twilio = MagicMock()

        def local_search(area_code, sms_enabled, limit):
            if area_code == "718":
                return []  # No numbers in 718
            elif area_code == "917":
                return [avail_fallback]  # Found in first fallback
            return []

        twilio.available_phone_numbers.return_value.local.list.side_effect = local_search
        twilio.incoming_phone_numbers.create.return_value = purchased
        mock_get_client.return_value = twilio

        result = await provision_number("718", CLIENT_ID)

    assert result == "+19175559876"


@pytest.mark.asyncio
async def test_provision_number_falls_back_to_tollfree():
    """When no local numbers found in any area code, should buy toll-free."""
    avail_tf = _mock_available("+18005559999")
    purchased = _mock_purchased("+18005559999")

    with patch("backend.services.twilio_service._get_client") as mock_get_client:
        twilio = MagicMock()
        # All local searches return empty.
        twilio.available_phone_numbers.return_value.local.list.return_value = []
        # Toll-free has one number.
        twilio.available_phone_numbers.return_value.toll_free.list.return_value = [avail_tf]
        twilio.incoming_phone_numbers.create.return_value = purchased
        mock_get_client.return_value = twilio

        result = await provision_number("718", CLIENT_ID)

    assert result == "+18005559999"
    twilio.available_phone_numbers.return_value.toll_free.list.assert_called_once()


@pytest.mark.asyncio
async def test_release_number_called_on_rollback():
    """release_number should find the number SID and delete it."""
    phone = "+17185551234"
    mock_number = MagicMock()
    mock_number.delete = MagicMock()

    with patch("backend.services.twilio_service._get_client") as mock_get_client:
        twilio = MagicMock()
        twilio.incoming_phone_numbers.list.return_value = [mock_number]
        mock_get_client.return_value = twilio

        await release_number(phone)

    twilio.incoming_phone_numbers.list.assert_called_once_with(
        phone_number=phone, limit=1
    )
    mock_number.delete.assert_called_once()


@pytest.mark.asyncio
async def test_provision_number_raises_when_nothing_available():
    """Should raise TwilioProvisionError when all searches fail."""
    with patch("backend.services.twilio_service._get_client") as mock_get_client:
        twilio = MagicMock()
        twilio.available_phone_numbers.return_value.local.list.return_value = []
        twilio.available_phone_numbers.return_value.toll_free.list.return_value = []
        mock_get_client.return_value = twilio

        with pytest.raises(TwilioProvisionError):
            await provision_number("999", CLIENT_ID)
