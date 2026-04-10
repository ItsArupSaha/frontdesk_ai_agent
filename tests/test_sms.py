"""Tests for backend/services/sms_service.py — Twilio fully mocked."""
import pytest
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# send_sms tests
# ---------------------------------------------------------------------------

@patch("backend.services.sms_service.TwilioClient")
def test_send_sms_calls_twilio_with_correct_params(mock_twilio_cls):
    from backend.services.sms_service import send_sms

    mock_client = MagicMock()
    mock_msg = MagicMock()
    mock_msg.sid = "SM_test_sid"
    mock_client.messages.create.return_value = mock_msg
    mock_twilio_cls.return_value = mock_client

    result = send_sms("+15551234567", "Hello caller!", "client_1")

    mock_client.messages.create.assert_called_once()
    call_kwargs = mock_client.messages.create.call_args.kwargs
    assert call_kwargs["to"] == "+15551234567"
    assert call_kwargs["body"] == "Hello caller!"
    assert result["success"] is True


@patch("backend.services.sms_service.TwilioClient")
def test_send_sms_returns_success_with_sid(mock_twilio_cls):
    from backend.services.sms_service import send_sms

    mock_client = MagicMock()
    mock_msg = MagicMock()
    mock_msg.sid = "SM_abc123"
    mock_client.messages.create.return_value = mock_msg
    mock_twilio_cls.return_value = mock_client

    result = send_sms("+15559876543", "Test message", "client_1")

    assert result == {"success": True, "sid": "SM_abc123"}


@patch("backend.services.sms_service.TwilioClient")
def test_send_sms_failure_returns_false_not_exception(mock_twilio_cls):
    """Twilio down must NOT raise — must return {'success': False}."""
    from backend.services.sms_service import send_sms

    mock_client = MagicMock()
    mock_client.messages.create.side_effect = Exception("Twilio 503 Service Unavailable")
    mock_twilio_cls.return_value = mock_client

    result = send_sms("+15551111111", "Test", "client_1")

    assert result["success"] is False
    assert "error" in result


def test_send_sms_invalid_number_returns_false():
    """A non-E.164 number should return failure without calling Twilio."""
    from backend.services.sms_service import send_sms

    result = send_sms("5551234567", "Test", "client_1")  # missing leading +

    assert result["success"] is False
    assert "Invalid" in result["error"]


# ---------------------------------------------------------------------------
# send_booking_confirmation tests
# ---------------------------------------------------------------------------

@patch("backend.services.sms_service.TwilioClient")
def test_send_booking_confirmation_correct_message_format(mock_twilio_cls):
    from backend.services.sms_service import send_booking_confirmation

    mock_client = MagicMock()
    mock_msg = MagicMock()
    mock_msg.sid = "SM_confirm"
    mock_client.messages.create.return_value = mock_msg
    mock_twilio_cls.return_value = mock_client

    result = send_booking_confirmation(
        booking_details={
            "caller_name": "Alice",
            "caller_phone": "+15550001234",
            "appointment_label": "Monday January 15 at 10:00 AM",
            "business_name": "Best Plumbing Co",
        },
        client_config={"id": "client_1"},
    )

    assert result["success"] is True
    sent_body = mock_client.messages.create.call_args.kwargs["body"]
    assert "Alice" in sent_body
    assert "Best Plumbing Co" in sent_body
    assert "Monday January 15 at 10:00 AM" in sent_body
    assert "Reply STOP" in sent_body


# ---------------------------------------------------------------------------
# send_missed_call_recovery tests
# ---------------------------------------------------------------------------

@patch("backend.services.sms_service.TwilioClient")
def test_send_missed_call_recovery_correct_message_format(mock_twilio_cls):
    from backend.services.sms_service import send_missed_call_recovery

    mock_client = MagicMock()
    mock_msg = MagicMock()
    mock_msg.sid = "SM_missed"
    mock_client.messages.create.return_value = mock_msg
    mock_twilio_cls.return_value = mock_client

    result = send_missed_call_recovery(
        caller_number="+15559998888",
        business_name="Ace HVAC",
        client_id="client_2",
    )

    assert result["success"] is True
    sent_body = mock_client.messages.create.call_args.kwargs["body"]
    assert "Ace HVAC" in sent_body
    assert "missed your call" in sent_body.lower() or "missed" in sent_body.lower()
