"""
Housecall Pro REST API integration for creating customers and jobs.

FSM sync is best-effort: failures are logged but never propagate to the
caller, so a Housecall Pro outage never breaks the booking flow.
"""
import httpx
import structlog

from backend.db.models import Booking

logger = structlog.get_logger(__name__)

HCP_BASE_URL = "https://api.housecallpro.com"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _auth_headers(hcp_api_key: str) -> dict:
    """Return Housecall Pro authentication headers.

    Args:
        hcp_api_key: Housecall Pro API key token.

    Returns:
        Headers dict with Authorization and Content-Type.
    """
    return {
        "Authorization": f"Token token={hcp_api_key}",
        "Content-Type": "application/json",
    }


async def _create_customer(
    booking: Booking,
    hcp_api_key: str,
    client: httpx.AsyncClient,
) -> str:
    """Create a customer in Housecall Pro.

    Args:
        booking: Confirmed booking with caller info.
        hcp_api_key: Housecall Pro API token.
        client: Shared httpx.AsyncClient instance.

    Returns:
        Housecall Pro customer ID string.

    Raises:
        httpx.HTTPStatusError: On non-2xx HTTP responses.
        KeyError: If the response body is missing expected fields.
    """
    name_parts = booking.caller_name.strip().split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    payload = {
        "first_name": first_name,
        "last_name": last_name,
        "email": "",
        "mobile_number": booking.caller_phone,
        "home_number": "",
        "work_number": "",
        "company": "",
        "notifications_enabled": True,
        "tags": [],
        "addresses": [
            {
                "type": "service",
                "street": booking.caller_address,
                "city": "",
                "state": "",
                "zip": "",
                "country": "US",
            }
        ],
    }

    response = await client.post(
        f"{HCP_BASE_URL}/customers",
        json=payload,
        headers=_auth_headers(hcp_api_key),
        timeout=10.0,
    )
    response.raise_for_status()
    return response.json()["id"]


async def _create_job(
    booking: Booking,
    customer_id: str,
    hcp_api_key: str,
    client: httpx.AsyncClient,
) -> str:
    """Create a job in Housecall Pro linked to a customer.

    Args:
        booking: Confirmed booking with service details.
        customer_id: Housecall Pro customer ID to link the job to.
        hcp_api_key: Housecall Pro API token.
        client: Shared httpx.AsyncClient instance.

    Returns:
        Housecall Pro job ID string.

    Raises:
        httpx.HTTPStatusError: On non-2xx HTTP responses.
        KeyError: If the response body is missing expected fields.
    """
    payload = {
        "customer_id": customer_id,
        "address": {"street": booking.caller_address},
        "note": booking.problem_description,
        "schedule": {
            "scheduled_start": booking.appointment_start.isoformat(),
            "scheduled_end": booking.appointment_end.isoformat(),
        },
        "tags": [],
        "line_items": [],
    }

    response = await client.post(
        f"{HCP_BASE_URL}/jobs",
        json=payload,
        headers=_auth_headers(hcp_api_key),
        timeout=10.0,
    )
    response.raise_for_status()
    return response.json()["id"]


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------


async def create_customer_and_job(
    booking: Booking,
    hcp_api_key: str,
) -> dict | None:
    """Create a Housecall Pro customer and linked job from a booking.

    Steps:
    1. POST /customers — create customer record.
    2. POST /jobs — create job linked to that customer.

    Args:
        booking: Confirmed booking model instance.
        hcp_api_key: Housecall Pro API token (per-client secret).

    Returns:
        {"customer_id": str, "job_id": str} on success.
        None on any failure — never raises so FSM sync stays best-effort.
    """
    try:
        async with httpx.AsyncClient() as http_client:
            customer_id = await _create_customer(booking, hcp_api_key, http_client)
            job_id = await _create_job(booking, customer_id, hcp_api_key, http_client)

        logger.info(
            "Housecall Pro sync complete",
            customer_id=customer_id,
            job_id=job_id,
            booking_id=str(booking.id),
        )
        return {"customer_id": customer_id, "job_id": job_id}

    except (httpx.HTTPStatusError, httpx.RequestError, KeyError) as exc:
        logger.error(
            "Housecall Pro API failure — booking sync skipped",
            error=str(exc),
            booking_id=str(booking.id),
        )
        return None
    except Exception as exc:
        logger.error(
            "Unexpected Housecall Pro error",
            error=str(exc),
            booking_id=str(booking.id),
        )
        return None
