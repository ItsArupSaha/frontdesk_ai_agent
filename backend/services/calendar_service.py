"""
Google Calendar integration for checking availability and booking appointments.
All functions are async; Google API calls are run in a thread pool to avoid
blocking the event loop.
"""
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from backend.config import settings
from backend.db.client import get_supabase
from backend.utils.encryption import decrypt, encrypt

logger = structlog.get_logger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar"]

EMERGENCY_KEYWORDS = [
    "burst pipe", "gas leak", "flooding", "no heat", "sparking",
    "fire", "emergency", "urgent", "overflow",
]

# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------


class CalendarNotConnectedError(Exception):
    """Raised when a client has no stored Google refresh token."""


class CalendarAuthError(Exception):
    """Raised when OAuth code exchange fails or returns no refresh token."""


class CalendarAPIError(Exception):
    """Raised when a Google Calendar API call fails."""


class CalendarBookingError(Exception):
    """Raised when event creation fails."""


# ---------------------------------------------------------------------------
# OAuth helpers
# ---------------------------------------------------------------------------


def _build_flow() -> Flow:
    """Build a google-auth-oauthlib Flow from env settings."""
    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uris": [settings.google_redirect_uri],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    return Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=settings.google_redirect_uri,
    )


def get_oauth_url(client_id: str) -> str:
    """Build the Google OAuth2 authorisation URL for a given client.

    Args:
        client_id: Internal client UUID used as the OAuth state parameter.

    Returns:
        Full Google authorisation URL string.
    """
    flow = _build_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=client_id,
    )
    return auth_url


async def handle_oauth_callback(code: str, client_id: str) -> None:
    """Exchange OAuth code for tokens and persist the encrypted refresh token.

    Args:
        code: The authorisation code returned by Google.
        client_id: Internal client UUID (was the OAuth state parameter).

    Raises:
        CalendarAuthError: If code exchange fails or no refresh_token is returned.
    """
    try:
        flow = _build_flow()
        flow.fetch_token(code=code)
        credentials = flow.credentials
    except Exception as exc:
        logger.error("Google OAuth code exchange failed", error=str(exc))
        raise CalendarAuthError(f"Code exchange failed: {exc}") from exc

    refresh_token = credentials.refresh_token
    if not refresh_token:
        raise CalendarAuthError(
            "No refresh_token in response. User may need to revoke access and re-authorise."
        )

    encrypted_token = encrypt(refresh_token)
    supabase = get_supabase()
    try:
        supabase.table("clients").update(
            {"google_calendar_refresh_token_enc": encrypted_token}
        ).eq("id", client_id).execute()
    except Exception as exc:
        logger.error("Failed to store refresh token", client_id=client_id, error=str(exc))
        raise CalendarAuthError(f"Failed to persist refresh token: {exc}") from exc


# ---------------------------------------------------------------------------
# Internal credential helper
# ---------------------------------------------------------------------------


def _get_credentials(client_id: str) -> Credentials:
    """Fetch and decrypt the Google credentials for a client.

    Args:
        client_id: Internal client UUID.

    Returns:
        google.oauth2.credentials.Credentials ready for API use.

    Raises:
        CalendarNotConnectedError: If no refresh token is stored.
    """
    supabase = get_supabase()
    result = (
        supabase.table("clients")
        .select("google_calendar_refresh_token_enc, google_calendar_id")
        .eq("id", client_id)
        .limit(1)
        .execute()
    )
    if not result.data or not result.data[0].get("google_calendar_refresh_token_enc"):
        raise CalendarNotConnectedError(
            f"Client {client_id} has no Google Calendar connected."
        )

    encrypted_token = result.data[0]["google_calendar_refresh_token_enc"]
    refresh_token = decrypt(encrypted_token)

    return Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=SCOPES,
    )


# ---------------------------------------------------------------------------
# Calendar availability
# ---------------------------------------------------------------------------


def _parse_working_hours(hours_str: str) -> tuple[int, int]:
    """Parse a string like '8am-6pm' into (start_hour, end_hour) in 24h."""
    try:
        start_str, end_str = hours_str.lower().split("-")
        def _to_24h(s: str) -> int:
            s = s.strip()
            if "am" in s:
                h = int(s.replace("am", ""))
                return h % 12
            elif "pm" in s:
                h = int(s.replace("pm", ""))
                return h % 12 + 12
            return int(s)
        return _to_24h(start_str), _to_24h(end_str)
    except Exception:
        return 8, 18  # default 8am-6pm


def _day_name_to_working_key(dt: datetime) -> str:
    """Map a datetime weekday to the working_hours dict key."""
    return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][dt.weekday()]


def _get_search_dates(date_preference: str) -> list[datetime]:
    """Return a list of dates to search based on the caller's preference."""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    pref = date_preference.lower().strip() if date_preference else ""

    if pref == "today":
        return [today]
    if pref == "tomorrow":
        return [today + timedelta(days=1)]
    if pref in ("this week", ""):
        return [today + timedelta(days=i) for i in range(5)]

    # Named day of week
    day_map = {
        "monday": 0, "tuesday": 1, "wednesday": 2,
        "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6,
    }
    if pref in day_map:
        target_wd = day_map[pref]
        current_wd = today.weekday()
        days_ahead = (target_wd - current_wd) % 7 or 7
        return [today + timedelta(days=days_ahead)]

    # Default: next 3 business days
    dates = []
    d = today
    while len(dates) < 3:
        d += timedelta(days=1)
        if d.weekday() < 5:
            dates.append(d)
    return dates


async def get_available_slots(
    client_id: str,
    date_preference: str,
    duration_minutes: int = 60,
) -> list[dict]:
    """Return up to 3 available calendar slots for a client.

    Args:
        client_id: Internal client UUID.
        date_preference: Natural language preference ('today', 'tomorrow', 'Monday', etc.).
        duration_minutes: Length of each appointment in minutes.

    Returns:
        List of slot dicts with 'start', 'end', and 'label' keys.

    Raises:
        CalendarAPIError: If the Google API call fails.
        CalendarNotConnectedError: If the client has no calendar connected.
    """
    creds = _get_credentials(client_id)

    # Fetch client working_hours and calendar_id from DB
    supabase = get_supabase()
    client_row = (
        supabase.table("clients")
        .select("working_hours, google_calendar_id")
        .eq("id", client_id)
        .limit(1)
        .execute()
    )
    working_hours: dict = {}
    calendar_id = "primary"
    if client_row.data:
        working_hours = client_row.data[0].get("working_hours") or {}
        calendar_id = client_row.data[0].get("google_calendar_id") or "primary"

    search_dates = _get_search_dates(date_preference)

    # Build freebusy query time range
    time_min = search_dates[0].isoformat()
    time_max = (search_dates[-1] + timedelta(days=1)).isoformat()

    try:
        service = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: build("calendar", "v3", credentials=creds, cache_discovery=False),
        )
        fb_result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: service.freebusy()
            .query(
                body={
                    "timeMin": time_min,
                    "timeMax": time_max,
                    "items": [{"id": calendar_id}],
                }
            )
            .execute(),
        )
    except HttpError as exc:
        logger.error("Google freebusy query failed", client_id=client_id, error=str(exc))
        raise CalendarAPIError(f"Google API error: {exc}") from exc

    busy_periods: list[dict] = fb_result.get("calendars", {}).get(calendar_id, {}).get("busy", [])

    slots: list[dict] = []

    for search_date in search_dates:
        if len(slots) >= 3:
            break

        day_key = _day_name_to_working_key(search_date)
        hours_str = working_hours.get(day_key, "8am-6pm")
        if hours_str == "closed":
            continue

        start_hour, end_hour = _parse_working_hours(hours_str)

        # Generate candidate slot starts at hourly intervals
        candidate = search_date.replace(hour=start_hour, minute=0)
        day_end = search_date.replace(hour=end_hour, minute=0)

        while candidate + timedelta(minutes=duration_minutes) <= day_end and len(slots) < 3:
            slot_start = candidate
            slot_end = candidate + timedelta(minutes=duration_minutes)

            # Check for overlap with busy periods
            overlaps = False
            for busy in busy_periods:
                b_start = datetime.fromisoformat(busy["start"].replace("Z", "+00:00"))
                b_end = datetime.fromisoformat(busy["end"].replace("Z", "+00:00"))
                if slot_start < b_end and slot_end > b_start:
                    overlaps = True
                    break

            if not overlaps:
                _day_n = str(slot_start.day)
                _hr_n = str(int(slot_start.strftime("%I")))
                label = slot_start.strftime(f"%A %B {_day_n} at {_hr_n}:%M %p")
                slots.append(
                    {
                        "start": slot_start.isoformat(),
                        "end": slot_end.isoformat(),
                        "label": label,
                    }
                )

            candidate += timedelta(minutes=60)

    return slots


# ---------------------------------------------------------------------------
# Booking
# ---------------------------------------------------------------------------


async def book_appointment(
    client_id: str,
    slot: dict,
    caller_details: dict,
) -> dict:
    """Create a Google Calendar event for a booked appointment.

    Args:
        client_id: Internal client UUID.
        slot: Dict with 'start' and 'end' ISO datetime strings.
        caller_details: Dict with name, phone, address, problem_description.

    Returns:
        The created event dict from Google Calendar (includes event id).

    Raises:
        CalendarBookingError: If event creation fails.
        CalendarNotConnectedError: If the client has no calendar connected.
    """
    creds = _get_credentials(client_id)

    supabase = get_supabase()
    client_row = (
        supabase.table("clients")
        .select("google_calendar_id")
        .eq("id", client_id)
        .limit(1)
        .execute()
    )
    calendar_id = "primary"
    if client_row.data:
        calendar_id = client_row.data[0].get("google_calendar_id") or "primary"

    problem = caller_details.get("problem_description", "")
    is_emergency_appt = any(kw in problem.lower() for kw in EMERGENCY_KEYWORDS)
    color_id = "11" if is_emergency_appt else "1"  # 11=red, 1=blue

    summary = f"{caller_details.get('name', 'Customer')} — {problem[:60]}"
    description = (
        f"Caller: {caller_details.get('name', '')}\n"
        f"Phone: {caller_details.get('phone', '')}\n"
        f"Address: {caller_details.get('address', '')}\n"
        f"Issue: {problem}\n"
    )

    event_body: dict[str, Any] = {
        "summary": summary,
        "description": description,
        "colorId": color_id,
        "start": {"dateTime": slot["start"], "timeZone": "America/New_York"},
        "end": {"dateTime": slot["end"], "timeZone": "America/New_York"},
    }

    try:
        service = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: build("calendar", "v3", credentials=creds, cache_discovery=False),
        )
        created_event = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: service.events()
            .insert(calendarId=calendar_id, body=event_body)
            .execute(),
        )
    except HttpError as exc:
        logger.error(
            "Google Calendar event creation failed",
            client_id=client_id,
            slot=slot,
            error=str(exc),
        )
        raise CalendarBookingError(
            f"Failed to create calendar event: {exc}"
        ) from exc

    logger.info(
        "Calendar event created",
        client_id=client_id,
        event_id=created_event.get("id"),
    )
    return created_event
