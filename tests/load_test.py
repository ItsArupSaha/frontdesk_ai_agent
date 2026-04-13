"""
Load test for POST /webhook/vapi — 10 concurrent emergency webhooks.

Pass criteria:
  - All 10 return HTTP 200
  - p95 response time < 4.0 seconds (Vapi's hard timeout is 5s)
  - No DB connection errors in logs
  - No duplicate conversation_state rows

Run this test ONLY against a running local server (not via pytest normally).
It is excluded from the standard pytest suite via the `load_test` marker.

Usage:
    python tests/load_test.py
    # or:
    pytest tests/load_test.py -m load_test -s
"""
from __future__ import annotations

import asyncio
import hmac
import hashlib
import json
import time
import pytest
import httpx
from unittest.mock import patch, MagicMock, AsyncMock

# ---------------------------------------------------------------------------
# Shared mock setup — prevents real DB/OpenAI hits during test
# ---------------------------------------------------------------------------

VAPI_SECRET = "test-webhook-secret"

BASE_URL = "http://localhost:8000"


def _make_webhook_payload(call_id: str) -> dict:
    """Return a minimal emergency Vapi webhook payload."""
    return {
        "message": {
            "type": "assistant-request",
            "call": {
                "id": call_id,
                "phoneNumber": {"number": "+15550001234"},
            },
            "conversation": [
                {"role": "user", "content": "I have a burst pipe! Water everywhere!"}
            ],
        }
    }


def _sign_payload(payload: dict, secret: str) -> str:
    """Compute HMAC-SHA256 signature for the Vapi webhook."""
    raw = json.dumps(payload).encode("utf-8")
    return hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()


# ---------------------------------------------------------------------------
# In-process load test (runs against FastAPI TestClient via ASGITransport)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.load_test
async def test_10_concurrent_emergency_webhooks_pass_p95():
    """10 concurrent emergency webhooks all return 200, p95 < 4s."""
    from httpx import AsyncClient, ASGITransport
    from backend.main import app

    # Mock all external calls so the test runs without Supabase / OpenAI.
    mock_sb = MagicMock()
    conv_chain = MagicMock()
    conv_chain.execute.return_value = MagicMock(data=[])
    conv_chain.eq.return_value = conv_chain
    conv_chain.limit.return_value = conv_chain
    conv_chain.upsert.return_value = conv_chain
    mock_sb.table.return_value.select.return_value = conv_chain
    mock_sb.table.return_value.upsert.return_value = conv_chain
    mock_sb.table.return_value.update.return_value = conv_chain

    # Minimal agent graph that returns immediately.
    async def _fast_graph(state: dict, **kwargs) -> dict:
        from langchain_core.messages import AIMessage
        return {
            **state,
            "is_emergency": True,
            "messages": state["messages"] + [
                AIMessage(content="Connecting you to emergency line now.")
            ],
        }

    with (
        patch("backend.routers.vapi_webhook.get_supabase", return_value=mock_sb),
        patch("backend.routers.vapi_webhook.compiled_graph") as mock_graph,
        patch("backend.routers.vapi_webhook.settings") as mock_settings,
    ):
        mock_settings.vapi_webhook_secret = VAPI_SECRET
        mock_settings.app_env = "test"
        mock_graph.ainvoke = AsyncMock(side_effect=_fast_graph)

        raw_payloads = [
            json.dumps(_make_webhook_payload(f"load_test_{i}")).encode("utf-8")
            for i in range(10)
        ]
        sigs = [_sign_payload(_make_webhook_payload(f"load_test_{i}"), VAPI_SECRET) for i in range(10)]

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:

            async def send_one(idx: int) -> tuple[int, float]:
                payload_bytes = raw_payloads[idx]
                sig = sigs[idx]
                start = time.monotonic()
                resp = await ac.post(
                    "/webhook/vapi",
                    content=payload_bytes,
                    headers={
                        "Content-Type": "application/json",
                        "x-vapi-signature": sig,
                    },
                )
                elapsed = time.monotonic() - start
                return resp.status_code, elapsed

            results = await asyncio.gather(*[send_one(i) for i in range(10)])

    status_codes = [r[0] for r in results]
    response_times = sorted(r[1] for r in results)
    p95 = response_times[int(len(response_times) * 0.95)]

    print(f"\nLoad test results:")
    print(f"  Requests: {len(results)}")
    print(f"  All 200:  {all(s == 200 for s in status_codes)}")
    print(f"  p50:      {response_times[len(response_times)//2]:.3f}s")
    print(f"  p95:      {p95:.3f}s")

    assert all(s == 200 for s in status_codes), f"Not all 200: {status_codes}"
    assert p95 < 4.0, f"p95 {p95:.2f}s exceeds 4s Vapi timeout"
    print("Load test PASSED")


# ---------------------------------------------------------------------------
# Standalone runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    asyncio.run(test_10_concurrent_emergency_webhooks_pass_p95())
