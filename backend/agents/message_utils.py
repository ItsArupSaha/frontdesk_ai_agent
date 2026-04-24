"""Shared utilities for extracting information from LangGraph message lists."""
from __future__ import annotations

from langchain_core.messages import AIMessage, HumanMessage

_FIELD_KEYWORDS: dict[str, list[str]] = {
    "caller_name": ["your name", "get your name", "name please", "may i have your name"],
    "caller_phone": ["phone", "number", "reach you", "callback number", "best number"],
    "caller_address": ["address", "service address", "location", "where is"],
    "problem_description": [
        "problem", "issue", "describe", "what's wrong", "help with",
        "what can i help", "how can i help",
    ],
}


def last_user_message(messages: list) -> str | None:
    """Return the content of the most recent HumanMessage, or None."""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            return msg.content
    return None


def last_ai_message(messages: list) -> str | None:
    """Return the content of the most recent AIMessage, or None."""
    for msg in reversed(messages):
        if isinstance(msg, AIMessage):
            return str(msg.content)
    return None


def clean_extracted_value(raw: str, field: str) -> str:
    """Strip common preamble phrases from a user's answer.

    Callers often say "My name is John" instead of just "John".
    We clean the raw captured string so the stored value is the actual datum.
    """
    import re
    text = raw.strip()

    if field == "caller_name":
        text = re.sub(
            r"(?i)^(my name is|i'?m|i am|this is|call me|it'?s)\s+", "", text
        ).strip()
    elif field == "caller_phone":
        m = re.search(r"[\+\d][\d\s\-\(\)]{6,}", text)
        if m:
            text = re.sub(r"\s+", "", m.group()).strip()
    elif field == "caller_address":
        text = re.sub(
            r"(?i)^(i'?m at|i live at|my address is|located at|it'?s at|address is)\s+",
            "",
            text,
        ).strip()
    elif field == "problem_description":
        text = re.sub(
            r"(?i)^(i have (a |an )?|there'?s (a |an )?|it'?s (a |an )?)\s*",
            "",
            text,
        ).strip()

    return text if text else raw.strip()


def try_extract_field(messages: list, field: str) -> str | None:
    """Search the full conversation history for a user answer to a field question.

    Walks all (AIMessage, HumanMessage) adjacent pairs in chronological order
    (most-recent first) and returns the user message that immediately followed
    an AI message containing the field's keywords.
    """
    keywords = _FIELD_KEYWORDS.get(field, [])
    if not keywords:
        return None

    for i in range(len(messages) - 1, 0, -1):
        if isinstance(messages[i], HumanMessage) and isinstance(messages[i - 1], AIMessage):
            ai_text = str(messages[i - 1].content).lower()
            user_text = messages[i].content
            if any(kw in ai_text for kw in keywords):
                return user_text
    return None


def is_in_service_area(address: str, service_area_description: str) -> bool:
    """Hybrid zip-code + keyword service area check.

    Strategy (in order):
    1. Extract 5-digit US zip codes from service_area_description.
       If any are found, only they are used — zip match is precise.
    2. Fall back to significant location keywords (city/borough names)
       when no zip codes appear in the description.
    3. Return True (allow booking) when description is empty or yields
       no usable tokens — better than silently rejecting valid callers.
    """
    import re as _re

    if not service_area_description or not address:
        return True

    zip_codes = set(_re.findall(r"\b\d{5}\b", service_area_description))
    if zip_codes:
        address_zips = set(_re.findall(r"\b\d{5}\b", address))
        if address_zips:
            return bool(zip_codes & address_zips)

    _STOP = {
        "serving", "and", "the", "new", "of", "in", "area", "areas",
        "service", "city", "cities", "our", "we", "cover", "coverage",
        "surrounding", "nearby", "local", "greater", "metro",
    }
    area_words = {
        w.strip(",.").lower()
        for w in service_area_description.split()
        if len(w.strip(",.")) > 3 and w.strip(",.").lower() not in _STOP
        and not _re.match(r"^\d+$", w.strip(",."))
    }

    if not area_words:
        return True

    address_lower = address.lower()
    return any(
        _re.search(r"\b" + _re.escape(word) + r"\b", address_lower)
        for word in area_words
    )
