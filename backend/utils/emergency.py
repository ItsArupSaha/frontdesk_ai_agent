EMERGENCY_KEYWORDS = {
    "plumbing": [
        "burst pipe", "flooding", "flood", "no water", "water everywhere",
        "sewage backup", "sewer backup", "gas leak", "gas smell",
        "smell gas", "water heater exploded", "pipe burst",
        "water pouring", "leaking everywhere"
    ],
    "hvac": [
        "no heat", "heat not working", "furnace not working", "no hot water",
        "carbon monoxide", "co alarm", "co detector", "gas smell",
        "no ac", "ac not working", "heat pump failed", "boiler not working",
        "freezing", "pipes might freeze"
    ],
    "electrical": [
        "sparking", "sparks", "burning smell", "smoke", "electrical fire",
        "power out", "no power", "tripped breaker won't reset",
        "outlet sparking", "burning outlet", "shocking", "getting shocked",
        "panel hot", "hot panel", "buzzing loudly"
    ],
    "general": [
        "emergency", "urgent", "asap", "immediately", "right now",
        "dangerous", "safety hazard", "could explode", "might explode"
    ]
}


def detect_emergency(text: str) -> tuple[bool, str | None]:
    """Detect whether caller text contains an emergency keyword.

    Returns (True, matched_keyword) on first match, (False, None) otherwise.
    Matching is case-insensitive substring search — multi-word phrases like
    "burst pipe" are matched correctly without word-boundary issues.
    """
    if not text:
        return False, None

    text_lower = text.lower()
    for _trade, keywords in EMERGENCY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text_lower:
                return True, keyword

    return False, None
