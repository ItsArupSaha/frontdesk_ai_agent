"""
Jobber GraphQL API integration for creating clients and job requests.

FSM sync is best-effort: failures are logged but never propagate to the
caller, so a Jobber outage never breaks the booking flow.
"""
import httpx
import structlog

from backend.db.models import Booking

logger = structlog.get_logger(__name__)

JOBBER_GRAPHQL_URL = "https://api.jobber.com/api/graphql"
JOBBER_API_VERSION = "2024-01-05"

# ---------------------------------------------------------------------------
# GraphQL query/mutation strings
# ---------------------------------------------------------------------------

_SEARCH_CLIENT_QUERY = """
query SearchClient($phone: String!) {
  clients(filter: { phone: $phone }) {
    nodes {
      id
    }
  }
}
"""

_CREATE_CLIENT_MUTATION = """
mutation CreateClient($input: ClientCreateInput!) {
  clientCreate(input: $input) {
    client {
      id
    }
    userErrors {
      message
      path
    }
  }
}
"""

_CREATE_REQUEST_MUTATION = """
mutation CreateRequest($input: RequestCreateInput!) {
  requestCreate(input: $input) {
    request {
      id
    }
    userErrors {
      message
      path
    }
  }
}
"""


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _graphql(
    query: str,
    variables: dict,
    jobber_api_key: str,
    client: httpx.AsyncClient,
) -> dict:
    """Execute a single GraphQL request against the Jobber API.

    Args:
        query: GraphQL query or mutation string.
        variables: Variable values for the operation.
        jobber_api_key: Bearer token for Jobber API auth.
        client: Shared httpx.AsyncClient instance.

    Returns:
        The parsed JSON response body.

    Raises:
        httpx.HTTPStatusError: On non-2xx HTTP responses.
        httpx.RequestError: On network-level failures.
    """
    headers = {
        "Authorization": f"Bearer {jobber_api_key}",
        "X-JOBBER-GRAPHQL-VERSION": JOBBER_API_VERSION,
        "Content-Type": "application/json",
    }
    response = await client.post(
        JOBBER_GRAPHQL_URL,
        json={"query": query, "variables": variables},
        headers=headers,
        timeout=10.0,
    )
    response.raise_for_status()
    return response.json()


async def _find_existing_client(
    phone: str,
    jobber_api_key: str,
    client: httpx.AsyncClient,
) -> str | None:
    """Search Jobber for an existing client by phone number.

    Args:
        phone: Caller's phone number (E.164).
        jobber_api_key: Jobber Bearer token.
        client: Shared httpx.AsyncClient instance.

    Returns:
        Jobber client ID string if found, else None.
    """
    data = await _graphql(
        _SEARCH_CLIENT_QUERY,
        {"phone": phone},
        jobber_api_key,
        client,
    )
    nodes = data.get("data", {}).get("clients", {}).get("nodes", [])
    if nodes:
        return nodes[0]["id"]
    return None


async def _create_client(
    booking: Booking,
    jobber_api_key: str,
    client: httpx.AsyncClient,
) -> str:
    """Create a new Jobber client from booking details.

    Args:
        booking: Confirmed booking with caller info.
        jobber_api_key: Jobber Bearer token.
        client: Shared httpx.AsyncClient instance.

    Returns:
        Newly created Jobber client ID string.

    Raises:
        RuntimeError: When the mutation returns userErrors.
    """
    name_parts = booking.caller_name.strip().split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    data = await _graphql(
        _CREATE_CLIENT_MUTATION,
        {
            "input": {
                "firstName": first_name,
                "lastName": last_name,
                "phones": [{"number": booking.caller_phone, "primary": True}],
                "billingAddress": {"street1": booking.caller_address},
            }
        },
        jobber_api_key,
        client,
    )
    result = data.get("data", {}).get("clientCreate", {})
    errors = result.get("userErrors", [])
    if errors:
        raise RuntimeError(f"Jobber clientCreate errors: {errors}")
    return result["client"]["id"]


async def _create_request(
    booking: Booking,
    client_id: str,
    jobber_api_key: str,
    client: httpx.AsyncClient,
) -> str:
    """Create a Jobber job request linked to an existing client.

    Args:
        booking: Confirmed booking with service details.
        client_id: Jobber client ID to attach the request to.
        jobber_api_key: Jobber Bearer token.
        client: Shared httpx.AsyncClient instance.

    Returns:
        Newly created Jobber request ID string.

    Raises:
        RuntimeError: When the mutation returns userErrors.
    """
    title = f"Service Request — {booking.caller_name}"
    description = (
        f"Problem: {booking.problem_description}\n"
        f"Address: {booking.caller_address}\n"
        f"Appointment: {booking.appointment_start.isoformat()}"
    )

    data = await _graphql(
        _CREATE_REQUEST_MUTATION,
        {
            "input": {
                "clientId": client_id,
                "title": title,
                "description": description,
            }
        },
        jobber_api_key,
        client,
    )
    result = data.get("data", {}).get("requestCreate", {})
    errors = result.get("userErrors", [])
    if errors:
        raise RuntimeError(f"Jobber requestCreate errors: {errors}")
    return result["request"]["id"]


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------


async def create_client_and_request(
    booking: Booking,
    jobber_api_key: str,
) -> dict | None:
    """Create (or reuse) a Jobber client and create a job request.

    Steps:
    1. Search Jobber for an existing client matching the caller's phone.
    2. If not found, create a new client.
    3. Create a job request linked to the client.

    Args:
        booking: Confirmed booking model instance.
        jobber_api_key: Jobber API Bearer token (per-client secret).

    Returns:
        {"client_id": str, "request_id": str} on success.
        None on any failure — never raises so FSM sync stays best-effort.
    """
    try:
        async with httpx.AsyncClient() as http_client:
            # Step 1: find existing client
            jobber_client_id = await _find_existing_client(
                booking.caller_phone, jobber_api_key, http_client
            )
            created_new = jobber_client_id is None

            # Step 2: create client if needed
            if jobber_client_id is None:
                jobber_client_id = await _create_client(
                    booking, jobber_api_key, http_client
                )

            # Step 3: create the request
            request_id = await _create_request(
                booking, jobber_client_id, jobber_api_key, http_client
            )

        logger.info(
            "Jobber sync complete",
            client_id=jobber_client_id,
            request_id=request_id,
            created_new_client=created_new,
            booking_id=str(booking.id),
        )
        return {"client_id": jobber_client_id, "request_id": request_id}

    except (httpx.HTTPStatusError, httpx.RequestError, RuntimeError, KeyError) as exc:
        logger.error(
            "Jobber API failure — booking sync skipped",
            error=str(exc),
            booking_id=str(booking.id),
        )
        return None
    except Exception as exc:
        logger.error(
            "Unexpected Jobber error",
            error=str(exc),
            booking_id=str(booking.id),
        )
        return None
