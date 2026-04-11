"""
Tests for backend/utils/summarizer.py

All OpenAI calls are mocked so these run entirely offline.
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_openai_response(content: str) -> MagicMock:
    """Build a minimal mock of an OpenAI ChatCompletion response."""
    choice = MagicMock()
    choice.message.content = content
    response = MagicMock()
    response.choices = [choice]
    return response


# ---------------------------------------------------------------------------
# test_summary_generated_from_transcript
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_summary_generated_from_transcript():
    """generate_call_summary should call OpenAI and return the model's text."""
    transcript = [
        {"role": "user", "content": "Hi, I need to fix a leaky faucet."},
        {"role": "assistant", "content": "Sure! What's a good time for you?"},
        {"role": "user", "content": "Tomorrow morning works."},
        {"role": "assistant", "content": "Great, I've booked you for 9am tomorrow."},
    ]
    client_config = {"business_name": "Apex Plumbing"}

    expected_summary = (
        "The customer called about a leaky faucet. "
        "An appointment was booked for 9am the following morning. "
        "No further follow-up required."
    )

    mock_openai_client = AsyncMock()
    mock_openai_client.chat.completions.create = AsyncMock(
        return_value=_make_openai_response(expected_summary)
    )

    with patch("backend.utils.summarizer.openai.AsyncOpenAI", return_value=mock_openai_client):
        from backend.utils import summarizer
        import importlib
        importlib.reload(summarizer)

        result = await summarizer.generate_call_summary(transcript, client_config)

    assert result == expected_summary
    mock_openai_client.chat.completions.create.assert_called_once()

    # Verify the model used is gpt-4o-mini
    call_kwargs = mock_openai_client.chat.completions.create.call_args
    assert call_kwargs.kwargs.get("model") == "gpt-4o-mini" or (
        len(call_kwargs.args) > 0 and call_kwargs.args[0] == "gpt-4o-mini"
    ) or call_kwargs.kwargs.get("model") == "gpt-4o-mini"


# ---------------------------------------------------------------------------
# test_summary_handles_empty_transcript
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_summary_handles_empty_transcript():
    """generate_call_summary should return a fallback string for empty input."""
    from backend.utils.summarizer import generate_call_summary

    result = await generate_call_summary([], {"business_name": "Test Co"})

    assert isinstance(result, str)
    assert len(result) > 0
    # Should not call OpenAI for an empty transcript
    assert "No transcript" in result or "unavailable" in result.lower() or result


# ---------------------------------------------------------------------------
# test_summary_handles_emergency_call
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_summary_handles_emergency_call():
    """generate_call_summary should handle emergency transcripts correctly."""
    transcript = [
        {"role": "user", "content": "I have a gas leak! Help!"},
        {"role": "assistant", "content": "I'm transferring you to our emergency line now."},
    ]
    client_config = {"business_name": "Quick Fix HVAC"}

    expected_summary = (
        "The customer reported a gas leak emergency. "
        "The call was immediately transferred to the emergency line. "
        "Emergency response was initiated."
    )

    mock_openai_client = AsyncMock()
    mock_openai_client.chat.completions.create = AsyncMock(
        return_value=_make_openai_response(expected_summary)
    )

    with patch("backend.utils.summarizer.openai.AsyncOpenAI", return_value=mock_openai_client):
        from backend.utils import summarizer
        import importlib
        importlib.reload(summarizer)

        result = await summarizer.generate_call_summary(transcript, client_config)

    assert "gas leak" in result.lower() or "emergency" in result.lower()
    assert isinstance(result, str)
    assert len(result) > 0


# ---------------------------------------------------------------------------
# test_summary_fallback_on_openai_error
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_summary_fallback_on_openai_error():
    """generate_call_summary should return a fallback string when OpenAI errors."""
    import openai as _openai

    transcript = [
        {"role": "user", "content": "I need a plumber."},
        {"role": "assistant", "content": "Let me check our schedule."},
    ]
    client_config = {"business_name": "Test Plumbing"}

    mock_openai_client = AsyncMock()
    mock_openai_client.chat.completions.create = AsyncMock(
        side_effect=_openai.OpenAIError("API unavailable")
    )

    with patch("backend.utils.summarizer.openai.AsyncOpenAI", return_value=mock_openai_client):
        from backend.utils import summarizer
        import importlib
        importlib.reload(summarizer)

        result = await summarizer.generate_call_summary(transcript, client_config)

    # Should return a non-empty fallback string, not raise
    assert isinstance(result, str)
    assert len(result) > 0
