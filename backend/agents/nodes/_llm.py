"""
LLM cache — one bound-tools instance per client_id to avoid rebuilding on
every node invocation (ChatOpenAI + bind_tools is not free).
Capped at _LLM_CACHE_MAX entries; oldest entry evicted when full so memory
stays bounded even as client count grows.
"""
from backend.config import settings

_LLM_CACHE_MAX = 200
_llm_cache: dict[str, object] = {}


def _get_llm(client_config: dict):
    """Return a cached LLM bound with the standard tool set.

    The ChatOpenAI instance and its bound tools are built once per client_id
    and reused across all node calls within the process lifetime.
    """
    from langchain_openai import ChatOpenAI
    from backend.agents.tools import build_tools

    client_id = client_config.get("id", "")
    if client_id not in _llm_cache:
        if len(_llm_cache) >= _LLM_CACHE_MAX:
            # Evict the oldest entry (insertion-order guaranteed in Python 3.7+).
            _llm_cache.pop(next(iter(_llm_cache)))
        api_key = settings.openai_api_key if settings.openai_api_key else "dummy"
        llm = ChatOpenAI(model="gpt-4o-mini", api_key=api_key)
        _llm_cache[client_id] = llm.bind_tools(build_tools(client_config, client_id))
    return _llm_cache[client_id]
