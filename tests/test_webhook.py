import pytest
from httpx import AsyncClient
import hmac
import hashlib
import json
from unittest.mock import AsyncMock, MagicMock, patch
import httpx # explicitly import instead of ASyncClient HTTPTransport
# wait, httpx AsyncClient expects an ASGITransport now? In httpx 0.27 it expects `transport=httpx.ASGITransport(app=app)`
from httpx import ASGITransport
from backend.main import app
from backend.config import settings
from langchain_core.messages import AIMessage

@pytest.fixture
def mock_verify():
    with patch("backend.routers.vapi_webhook.verify_vapi_secret", return_value=True) as m:
        yield m

@pytest.mark.asyncio
async def test_valid_webhook_returns_200(mock_verify):
    body = {"message": {"type": "assistant-request", "call": {"id": "t", "phoneNumber": {"number": "1"}}, "conversation": []}}
    with patch("backend.routers.vapi_webhook.compiled_graph.ainvoke", new_callable=AsyncMock) as mock_ainvoke:
        mock_ainvoke.return_value = {"messages": [AIMessage(content="Hi")]}
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post("/webhook/vapi", json=body, headers={"Authorization": "Bearer valid"})
        assert response.status_code == 200

@pytest.mark.asyncio
async def test_invalid_signature_returns_403():
    body = {"message": {"type": "assistant-request", "call": {"id": "t", "phoneNumber": {"number": "1"}}, "conversation": []}}
    with patch("backend.routers.vapi_webhook.verify_vapi_secret", return_value=False):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post("/webhook/vapi", json=body, headers={"Authorization": "Bearer invalid"})
        assert response.status_code == 403

@pytest.mark.asyncio
async def test_emergency_keyword_triggers_transfer(mock_verify):
    body = {"message": {"type": "assistant-request", "call": {"id": "t", "phoneNumber": {"number": "1"}}, "conversation": [{"role": "user", "content": "I have a burst pipe"}]}}

    # Mock Supabase so no real DB call runs; client lookup returns no rows
    # which causes the fallback client_config (emergency_number=+15550000000).
    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
    mock_sb.table.return_value.upsert.return_value.execute.return_value = MagicMock(data=[])

    with (
        patch("backend.routers.vapi_webhook.compiled_graph.ainvoke", new_callable=AsyncMock) as mock_ainvoke,
        patch("backend.routers.vapi_webhook.get_supabase", return_value=mock_sb),
    ):
        mock_ainvoke.return_value = {"messages": [AIMessage(content="", tool_calls=[{"name": "escalate_call", "args": {"reason":"burst pipe", "caller_summary":"burst pipe"}, "id": "1", "type": "tool_call"}])]}
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post("/webhook/vapi", json=body, headers={"Authorization": "Bearer valid"})
        assert response.status_code == 200
        data = response.json()
        assert data["response"]["action"] == "transfer-call"
        assert data["response"]["phoneNumber"] == "+15550000000"

@pytest.mark.asyncio
async def test_normal_call_returns_text_response(mock_verify):
    body = {"message": {"type": "assistant-request", "call": {"id": "t", "phoneNumber": {"number": "1"}}, "conversation": [{"role": "user", "content": "Hello"}]}}
    with patch("backend.routers.vapi_webhook.compiled_graph.ainvoke", new_callable=AsyncMock) as mock_ainvoke:
        mock_ainvoke.return_value = {"messages": [AIMessage(content="How can I help you today?")]}
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post("/webhook/vapi", json=body, headers={"Authorization": "Bearer valid"})
        assert response.status_code == 200
        data = response.json()
        assert "message" in data["response"]
        assert data["response"]["message"] == "How can I help you today?"

@pytest.mark.asyncio
async def test_vapi_timeout_fallback(mock_verify):
    body = {"message": {"type": "assistant-request", "call": {"id": "t", "phoneNumber": {"number": "1"}}, "conversation": []}}
    with patch("backend.routers.vapi_webhook.compiled_graph.ainvoke", new_callable=AsyncMock) as mock_ainvoke:
        import asyncio
        async def sleep_long(*args, **kwargs):
            raise asyncio.TimeoutError() # skip actually waiting
        mock_ainvoke.side_effect = sleep_long
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post("/webhook/vapi", json=body, headers={"Authorization": "Bearer valid"})
        assert response.status_code == 200
        data = response.json()
        assert data["response"]["action"] == "transfer-call"
