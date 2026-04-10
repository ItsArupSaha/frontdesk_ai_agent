"""Tests for the collect_info_node in backend/agents/nodes.py."""
import pytest
from unittest.mock import AsyncMock, patch
from langchain_core.messages import AIMessage, HumanMessage


def _make_state(**overrides) -> dict:
    base = {
        "messages": [],
        "client_id": "client_1",
        "call_id": "call_1",
        "current_node": "collect_info",
        "caller_name": None,
        "caller_phone": None,
        "caller_address": None,
        "problem_description": None,
        "is_emergency": False,
        "service_area_confirmed": False,
        "collection_complete": False,
        "available_slots": [],
        "chosen_slot": None,
        "booking_complete": False,
        "client_config": {"business_name": "Test Co", "id": "client_1"},
    }
    base.update(overrides)
    return base


@pytest.mark.asyncio
@patch("backend.agents.nodes._get_llm")
async def test_asks_name_when_missing(mock_get_llm):
    from backend.agents.nodes import collect_info_node

    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value = AIMessage(content="Can I get your name?")
    mock_get_llm.return_value = mock_llm

    state = _make_state(
        messages=[HumanMessage(content="I need my AC fixed")],
    )
    result = await collect_info_node(state)

    assert "messages" in result
    assert result["current_node"] == "collect_info"
    assert result.get("collection_complete") is not True


@pytest.mark.asyncio
@patch("backend.agents.nodes._get_llm")
async def test_asks_phone_after_name_collected(mock_get_llm):
    from backend.agents.nodes import collect_info_node

    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value = AIMessage(content="What's the best number to reach you?")
    mock_get_llm.return_value = mock_llm

    state = _make_state(
        caller_name="John Smith",
        messages=[
            HumanMessage(content="I need AC fixed"),
            AIMessage(content="Can I get your name?"),
            HumanMessage(content="John Smith"),
        ],
    )
    result = await collect_info_node(state)

    assert result["current_node"] == "collect_info"
    # Phone not yet collected
    assert result.get("collection_complete") is not True


@pytest.mark.asyncio
@patch("backend.agents.nodes._get_llm")
async def test_asks_address_after_phone_collected(mock_get_llm):
    from backend.agents.nodes import collect_info_node

    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value = AIMessage(content="What's the service address?")
    mock_get_llm.return_value = mock_llm

    state = _make_state(
        caller_name="Jane Doe",
        caller_phone="+15551112222",
        messages=[
            HumanMessage(content="I need a plumber"),
            AIMessage(content="Can I get your name?"),
            HumanMessage(content="Jane Doe"),
            AIMessage(content="What's the best number to reach you?"),
            HumanMessage(content="+15551112222"),
        ],
    )
    result = await collect_info_node(state)

    assert result["current_node"] == "collect_info"
    assert result.get("collection_complete") is not True


@pytest.mark.asyncio
async def test_sets_collection_complete_when_all_collected():
    from backend.agents.nodes import collect_info_node

    state = _make_state(
        caller_name="Bob",
        caller_phone="+15553334444",
        caller_address="123 Main St",
        problem_description="leaky faucet",
    )
    result = await collect_info_node(state)

    assert result.get("collection_complete") is True
    assert result["current_node"] == "booking"


@pytest.mark.asyncio
@patch("backend.agents.nodes._get_llm")
async def test_does_not_ask_already_collected_fields(mock_get_llm):
    from backend.agents.nodes import collect_info_node

    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value = AIMessage(content="What's the service address?")
    mock_get_llm.return_value = mock_llm

    state = _make_state(
        caller_name="Alice",
        caller_phone="+15550009999",
        # address and problem still missing
        messages=[HumanMessage(content="My sink is broken")],
    )
    result = await collect_info_node(state)

    # The LLM was called with a system prompt — check it doesn't re-ask name/phone
    call_args = mock_get_llm.return_value.ainvoke.call_args
    system_msg = call_args[0][0][0]  # first message = SystemMessage
    assert "Alice" in system_msg.content
    assert "+15550009999" in system_msg.content
