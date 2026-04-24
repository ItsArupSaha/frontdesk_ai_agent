"""
LangGraph node functions for the AI front-desk agent.

Each node processes one conversation turn and returns a partial state update.
The LangGraph runner merges partial updates into the cumulative AgentState.

Implementation is split across focused sub-modules:
  _llm.py         — shared LLM cache
  greeting.py     — greeting_node
  qualify.py      — qualify_node
  emergency.py    — emergency_node
  collect_info.py — collect_info_node
  booking.py      — booking_node
  routing.py      — routing_node
"""
from backend.agents.nodes._llm import _get_llm
from backend.agents.nodes.greeting import greeting_node
from backend.agents.nodes.qualify import qualify_node
from backend.agents.nodes.emergency import emergency_node
from backend.agents.nodes.collect_info import collect_info_node
from backend.agents.nodes.booking import booking_node
from backend.agents.nodes.routing import routing_node

__all__ = [
    "_get_llm",
    "greeting_node",
    "qualify_node",
    "emergency_node",
    "collect_info_node",
    "booking_node",
    "routing_node",
]
