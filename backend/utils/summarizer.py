"""
Call summarizer for the AI front-desk agent.

Generates a concise, structured summary of a completed call using
OpenAI gpt-4o-mini. The summary is stored in call_logs.summary so
clients can review readable call history in the dashboard.
"""
from __future__ import annotations

from typing import Any

import openai
import structlog

from backend.config import settings

logger = structlog.get_logger(__name__)

_SUMMARY_SYSTEM_PROMPT = (
    "You are a concise call summarizer for a home services company. "
    "You receive a call transcript and produce a plain-text summary."
)

_SUMMARY_USER_TEMPLATE = """\
Summarize this call in 3-4 sentences. Include:
- What the customer needed
- What was resolved or booked
- Any follow-up needed

Be factual and concise. Do not add commentary or opinions.

Business: {business_name}

Transcript:
{transcript_text}
"""


async def generate_call_summary(
    transcript: list[dict[str, str]],
    client_config: dict[str, Any],
) -> str:
    """Generate a structured summary of a completed call.

    Uses OpenAI gpt-4o-mini to summarise the transcript into 3-4 readable
    sentences covering what was needed, what was resolved, and any follow-up.

    Args:
        transcript: List of message dicts with 'role' and 'content' keys,
            e.g. [{"role": "user", "content": "..."}, {"role": "assistant", ...}].
        client_config: Client config dict (used to include business_name in
            the prompt for context).

    Returns:
        A summary string, or a minimal fallback string if generation fails.
    """
    if not transcript:
        return "No transcript available for this call."

    # Format transcript for the prompt
    lines: list[str] = []
    for msg in transcript:
        role = msg.get("role", "unknown").capitalize()
        content = msg.get("content", "")
        if role.lower() in ("__slots__",):
            continue  # skip internal sentinel messages
        lines.append(f"{role}: {content}")

    transcript_text = "\n".join(lines)
    if not transcript_text.strip():
        return "No transcript available for this call."

    business_name = client_config.get("business_name", "the business")

    user_prompt = _SUMMARY_USER_TEMPLATE.format(
        business_name=business_name,
        transcript_text=transcript_text,
    )

    try:
        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _SUMMARY_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=300,
            temperature=0.2,
        )
        summary = response.choices[0].message.content or ""
        return summary.strip()

    except openai.OpenAIError as exc:
        logger.error("Call summary generation failed", error=str(exc))
        # Return a minimal fallback rather than crashing
        return "Summary unavailable due to a generation error."
