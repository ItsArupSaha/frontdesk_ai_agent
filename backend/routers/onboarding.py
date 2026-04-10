"""
Google OAuth2 onboarding routes.
These are hit by the onboarding flow when a new client connects their Google Calendar.
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, RedirectResponse

from backend.services.calendar_service import (
    CalendarAuthError,
    get_oauth_url,
    handle_oauth_callback,
)
from backend.utils.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()

_SUCCESS_HTML = """
<html>
<body style="font-family:sans-serif;text-align:center;padding:60px">
<h2>&#10003; Google Calendar connected!</h2>
<p>You can close this tab and return to setup.</p>
</body>
</html>
""".strip()

_ERROR_HTML = """
<html>
<body style="font-family:sans-serif;text-align:center;padding:60px">
<h2>&#10007; Connection failed</h2>
<p>{error}</p>
<p>Please close this tab, revoke Google Calendar access in your Google account,
and try the &ldquo;Connect Calendar&rdquo; button again.</p>
</body>
</html>
""".strip()


@router.get("/auth/google/connect")
async def google_connect(client_id: str) -> RedirectResponse:
    """Redirect the browser to Google's OAuth consent screen.

    Query params:
        client_id: Internal client UUID.
    """
    auth_url = get_oauth_url(client_id)
    return RedirectResponse(url=auth_url)


@router.get("/auth/google/callback")
async def google_callback(code: str, state: str) -> HTMLResponse:
    """Handle Google's redirect back after user grants consent.

    Query params:
        code: Authorisation code from Google.
        state: Client UUID that was passed as the OAuth state parameter.
    """
    client_id = state
    try:
        await handle_oauth_callback(code, client_id)
        return HTMLResponse(content=_SUCCESS_HTML, status_code=200)
    except CalendarAuthError as exc:
        logger.error("Google OAuth callback error", client_id=client_id, error=str(exc))
        error_html = _ERROR_HTML.format(error=str(exc))
        return HTMLResponse(content=error_html, status_code=400)
