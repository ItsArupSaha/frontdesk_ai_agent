"""SMS message template builders — single source of truth for all outbound SMS text."""
from __future__ import annotations


def booking_confirmation_sms(
    caller_name: str,
    business_name: str,
    appointment_label: str,
) -> str:
    """Build booking confirmation SMS body."""
    return (
        f"Hi {caller_name}! Your appointment with {business_name} is confirmed "
        f"for {appointment_label}. We'll see you then! Reply STOP to opt out."
    )


def missed_call_recovery_sms(
    business_name: str,
    calling_number: str | None = None,
) -> str:
    """Build missed-call recovery SMS body."""
    if calling_number:
        return (
            f"Hi, we're sorry for any inconvenience during your recent call with "
            f"{business_name}. Please call us back at {calling_number} "
            f"and we'll be happy to assist you."
        )
    return (
        f"Hi, we're sorry for any inconvenience during your recent call with "
        f"{business_name}. Please give us a call back and we'll be happy to assist you."
    )


def booking_reminder_sms(
    business_name: str,
    appointment_label: str,
    caller_address: str,
) -> str:
    """Build 24h pre-appointment reminder SMS body."""
    return (
        f"Reminder: {business_name} appointment tomorrow at {appointment_label}. "
        f"Address: {caller_address}. Questions? Reply here."
    )


def callback_request_message(
    caller_name: str | None,
    caller_phone: str,
    reason: str,
) -> str:
    """Build callback request message for reminders_queue."""
    return f"CALLBACK NEEDED — {caller_name or 'Unknown'} ({caller_phone}): {reason}"


def review_request_sms(
    caller_name: str,
    business_name: str,
    review_link: str | None = None,
) -> str:
    """Build post-job Google review request SMS body."""
    if review_link:
        return (
            f"Hi {caller_name}! Hope {business_name} took great care of you. "
            f"Mind leaving a quick review? It means a lot: "
            f"https://g.page/{review_link}/review  Reply STOP to opt out."
        )
    return (
        f"Hi {caller_name}! Hope {business_name} took great care of you. "
        f"We'd love your feedback — give us a call anytime!  Reply STOP to opt out."
    )
