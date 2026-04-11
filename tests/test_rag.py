"""
Tests for backend/services/rag_service.py

All OpenAI and Supabase calls are mocked so these run entirely offline.
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_embedding(dims: int = 1536) -> list[float]:
    """Return a dummy embedding vector of the expected length."""
    return [0.1] * dims


# ---------------------------------------------------------------------------
# test_embed_text_returns_1536_dimensions
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_embed_text_returns_1536_dimensions():
    """embed_text should return a list of exactly 1536 floats."""
    dummy_vector = _make_embedding(1536)

    mock_response = MagicMock()
    mock_response.data = [MagicMock(embedding=dummy_vector)]

    mock_client = AsyncMock()
    mock_client.embeddings.create = AsyncMock(return_value=mock_response)

    with patch("backend.services.rag_service.openai.AsyncOpenAI", return_value=mock_client):
        from backend.services.rag_service import embed_text
        result = await embed_text("test input")

    assert isinstance(result, list)
    assert len(result) == 1536
    assert all(isinstance(v, float) for v in result)


# ---------------------------------------------------------------------------
# test_ingest_creates_chunks_for_each_service
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ingest_creates_chunks_for_each_service():
    """ingest_client_knowledge should embed one chunk per service (and extras)."""
    dummy_vector = _make_embedding()
    client_config = {
        "business_name": "Apex Plumbing",
        "services_offered": ["drain cleaning", "water heater repair", "pipe installation"],
        "working_hours": {"mon-fri": "8am-6pm"},
        "service_area_description": "Greater Boston area",
    }

    mock_embed_response = MagicMock()
    mock_embed_response.data = [MagicMock(embedding=dummy_vector)]

    mock_openai_client = AsyncMock()
    mock_openai_client.embeddings.create = AsyncMock(return_value=mock_embed_response)

    # Mock supabase so no real DB calls happen
    mock_table = MagicMock()
    mock_table.delete.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    mock_table.insert.return_value.execute.return_value = MagicMock(data=[])

    mock_supabase = MagicMock()
    mock_supabase.table.return_value = mock_table

    with (
        patch("backend.services.rag_service.openai.AsyncOpenAI", return_value=mock_openai_client),
        patch("backend.services.rag_service.get_supabase", return_value=mock_supabase),
    ):
        from backend.services.rag_service import ingest_client_knowledge
        await ingest_client_knowledge("client-123", client_config)

    # 3 services + working_hours + service_area + business_description = 6 chunks
    assert mock_openai_client.embeddings.create.call_count >= 3
    # Verify delete was called to clear stale chunks
    mock_table.delete.assert_called_once()
    # Verify insert was called with the embedded rows
    mock_table.insert.assert_called_once()
    inserted_rows = mock_table.insert.call_args[0][0]
    assert len(inserted_rows) >= 3
    categories = {r["category"] for r in inserted_rows}
    assert "services" in categories


# ---------------------------------------------------------------------------
# test_query_returns_relevant_content
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_query_returns_relevant_content():
    """query_knowledge should return concatenated content strings from the DB."""
    dummy_vector = _make_embedding()

    mock_embed_response = MagicMock()
    mock_embed_response.data = [MagicMock(embedding=dummy_vector)]

    mock_openai_client = AsyncMock()
    mock_openai_client.embeddings.create = AsyncMock(return_value=mock_embed_response)

    rpc_result = MagicMock()
    rpc_result.data = [
        {"content": "We offer water heater repair."},
        {"content": "We offer tankless water heater installation."},
    ]

    mock_supabase = MagicMock()
    mock_supabase.rpc.return_value.execute.return_value = rpc_result

    with (
        patch("backend.services.rag_service.openai.AsyncOpenAI", return_value=mock_openai_client),
        patch("backend.services.rag_service.get_supabase", return_value=mock_supabase),
    ):
        from backend.services.rag_service import query_knowledge
        result = await query_knowledge("client-123", "do you fix water heaters?")

    assert "water heater repair" in result
    assert "tankless" in result


# ---------------------------------------------------------------------------
# test_query_returns_empty_string_if_no_chunks
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_query_returns_empty_string_if_no_chunks():
    """query_knowledge should return '' when there are no matching chunks."""
    dummy_vector = _make_embedding()

    mock_embed_response = MagicMock()
    mock_embed_response.data = [MagicMock(embedding=dummy_vector)]

    mock_openai_client = AsyncMock()
    mock_openai_client.embeddings.create = AsyncMock(return_value=mock_embed_response)

    rpc_result = MagicMock()
    rpc_result.data = []  # no rows

    mock_supabase = MagicMock()
    mock_supabase.rpc.return_value.execute.return_value = rpc_result

    with (
        patch("backend.services.rag_service.openai.AsyncOpenAI", return_value=mock_openai_client),
        patch("backend.services.rag_service.get_supabase", return_value=mock_supabase),
    ):
        from backend.services.rag_service import query_knowledge
        result = await query_knowledge("client-123", "anything?")

    assert result == ""
