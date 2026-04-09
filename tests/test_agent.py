import pytest
from unittest.mock import AsyncMock, patch
from backend.agents.nodes import greeting_node, qualify_node, emergency_node, routing_node
from langchain_core.messages import HumanMessage, AIMessage

@pytest.fixture
def mock_state():
    return {
        "messages": [HumanMessage(content="Hello")],
        "client_config": {
            "business_name": "Test",
            "emergency_phone_number": "123"
        },
        "is_emergency": False
    }

@pytest.mark.asyncio
@patch("backend.agents.nodes._get_llm")
async def test_greeting_node_returns_response(mock_get_llm, mock_state):
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value = AIMessage(content="Hi there")
    mock_get_llm.return_value = mock_llm
    
    res = await greeting_node(mock_state)
    assert res["messages"][0].content == "Hi there"

@pytest.mark.asyncio
@patch("backend.agents.nodes._get_llm")
async def test_qualify_node_detects_emergency(mock_get_llm):
    state = {
        "messages": [HumanMessage(content="I have a burst pipe")],
        "client_config": {},
        "is_emergency": False
    }
    res = await qualify_node(state)
    assert res["is_emergency"] is True

@pytest.mark.asyncio
@patch("backend.agents.nodes._get_llm")
async def test_qualify_node_asks_questions(mock_get_llm):
    state = {
        "messages": [HumanMessage(content="I need a new sink")],
        "client_config": {},
        "is_emergency": False
    }
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value = AIMessage(content="What is your address?")
    mock_get_llm.return_value = mock_llm
    
    res = await qualify_node(state)
    assert "messages" in res
    assert res["messages"][0].content == "What is your address?"

@pytest.mark.asyncio
@patch("backend.agents.nodes._get_llm")
async def test_emergency_node_calls_escalate_tool(mock_get_llm):
    state = {
        "messages": [HumanMessage(content="burst pipe")],
        "client_config": {},
        "is_emergency": True
    }
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value = AIMessage(content="", tool_calls=[{"name": "escalate_call", "args": {}, "id": "1"}])
    mock_get_llm.return_value = mock_llm
    
    res = await emergency_node(state)
    assert res["messages"][0].tool_calls

def test_routing_to_emergency():
    assert routing_node({"is_emergency": True}) == "emergency"

def test_routing_to_qualify():
    assert routing_node({"is_emergency": False, "messages": []}) == "qualify"
