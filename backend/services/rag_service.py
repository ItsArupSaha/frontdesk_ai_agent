"""
RAG (Retrieval-Augmented Generation) service for the AI front-desk agent.

Handles embedding business knowledge into pgvector and querying relevant
chunks at inference time so the agent gives accurate, business-specific answers.
"""
from __future__ import annotations

import json
from typing import Any

import openai
import structlog

from backend.config import settings
from backend.db.client import get_supabase

logger = structlog.get_logger(__name__)

# Categories used when ingesting client knowledge
_CATEGORY_SERVICES = "services"
_CATEGORY_HOURS = "hours"
_CATEGORY_AREA = "area"
_CATEGORY_PRICING = "pricing"
_CATEGORY_DESCRIPTION = "description"


async def embed_text(text: str) -> list[float]:
    """Embed a single text string using OpenAI text-embedding-3-small.

    Args:
        text: The text to embed.

    Returns:
        A 1536-dimension float vector.

    Raises:
        openai.OpenAIError: If the OpenAI API call fails.
    """
    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding


async def ingest_client_knowledge(client_id: str, client_config: dict[str, Any]) -> None:
    """Convert client_config into embedded knowledge chunks and upsert to Supabase.

    Called once during client onboarding and whenever the client updates
    their settings. Deletes existing chunks for the client before re-inserting
    so stale data is never left behind.

    Args:
        client_id: The client's UUID string.
        client_config: Dict containing business details (name, services, hours, etc.).
    """
    chunks: list[dict[str, str]] = []

    # One chunk per service offered
    services: list[str] = client_config.get("services_offered", [])
    for service in services:
        chunks.append({
            "category": _CATEGORY_SERVICES,
            "content": f"We offer the following service: {service}.",
        })

    # Working hours chunk
    working_hours = client_config.get("working_hours")
    if working_hours:
        if isinstance(working_hours, dict):
            hours_text = json.dumps(working_hours)
        else:
            hours_text = str(working_hours)
        chunks.append({
            "category": _CATEGORY_HOURS,
            "content": f"Our working hours are: {hours_text}.",
        })

    # Service area chunk
    service_area = client_config.get("service_area_description")
    if service_area:
        chunks.append({
            "category": _CATEGORY_AREA,
            "content": f"Our service area covers: {service_area}.",
        })

    # Pricing chunk (optional)
    pricing = client_config.get("pricing_ranges")
    if pricing:
        if isinstance(pricing, dict):
            pricing_text = json.dumps(pricing)
        else:
            pricing_text = str(pricing)
        chunks.append({
            "category": _CATEGORY_PRICING,
            "content": f"Our pricing ranges are: {pricing_text}.",
        })

    # Business description chunk
    business_name = client_config.get("business_name", "")
    if business_name:
        chunks.append({
            "category": _CATEGORY_DESCRIPTION,
            "content": (
                f"Our business is called {business_name}. "
                f"We are a professional service company."
            ),
        })

    if not chunks:
        logger.warning("No knowledge chunks to ingest", client_id=client_id)
        return

    # Embed all chunks
    embedded_rows: list[dict[str, Any]] = []
    for chunk in chunks:
        try:
            vector = await embed_text(chunk["content"])
        except openai.OpenAIError as exc:
            logger.error(
                "Embedding failed — skipping chunk",
                client_id=client_id,
                category=chunk["category"],
                error=str(exc),
            )
            continue
        embedded_rows.append({
            "client_id": client_id,
            "content": chunk["content"],
            "embedding": vector,
            "category": chunk["category"],
        })

    if not embedded_rows:
        logger.error("All embeddings failed — no chunks ingested", client_id=client_id)
        return

    supabase = get_supabase()
    # Delete existing chunks for this client, then insert fresh ones
    try:
        supabase.table("knowledge_chunks").delete().eq("client_id", client_id).execute()
        supabase.table("knowledge_chunks").insert(embedded_rows).execute()
        logger.info(
            "Knowledge ingestion complete",
            client_id=client_id,
            chunk_count=len(embedded_rows),
        )
    except Exception as exc:
        logger.error("DB upsert failed during ingestion", client_id=client_id, error=str(exc))
        raise


async def ingest_document_text(client_id: str, text: str, filename: str) -> int:
    """Embed and store raw document text as knowledge chunks (additive — does not wipe existing).

    Splits text into ~500-char chunks, embeds each, and inserts them alongside
    existing knowledge chunks (services, hours, etc.).  Returns the number of
    chunks successfully ingested.

    Args:
        client_id: The client's UUID string.
        text: Extracted plain text from an uploaded document.
        filename: Original filename (used as category label for tracing).

    Returns:
        Number of chunks ingested.
    """
    # Split into ~500-char chunks on sentence/paragraph boundaries.
    _CHUNK_SIZE = 500
    _OVERLAP = 50
    raw = text.strip()
    if not raw:
        return 0

    chunks: list[str] = []
    start = 0
    while start < len(raw):
        end = min(start + _CHUNK_SIZE, len(raw))
        # Try to break on whitespace to avoid mid-word splits.
        if end < len(raw):
            break_at = raw.rfind(" ", start, end)
            if break_at > start:
                end = break_at
        chunks.append(raw[start:end].strip())
        start = end - _OVERLAP if end < len(raw) else end

    embedded_rows: list[dict[str, Any]] = []
    category = f"document:{filename}"
    for chunk in chunks:
        if not chunk:
            continue
        try:
            vector = await embed_text(chunk)
        except openai.OpenAIError as exc:
            logger.warning("Document chunk embedding failed", client_id=client_id, error=str(exc))
            continue
        embedded_rows.append({
            "client_id": client_id,
            "content": chunk,
            "embedding": vector,
            "category": category,
        })

    if not embedded_rows:
        return 0

    supabase = get_supabase()
    try:
        # Delete stale chunks from this specific document before re-inserting.
        supabase.table("knowledge_chunks").delete().eq(
            "client_id", client_id
        ).eq("category", category).execute()
        supabase.table("knowledge_chunks").insert(embedded_rows).execute()
        logger.info(
            "Document ingestion complete",
            client_id=client_id,
            filename=filename,
            chunk_count=len(embedded_rows),
        )
    except Exception as exc:
        logger.error("Document DB insert failed", client_id=client_id, error=str(exc))
        raise

    return len(embedded_rows)


async def query_knowledge(
    client_id: str,
    question: str,
    top_k: int = 3,
) -> str:
    """Retrieve the most relevant knowledge chunks for a given question.

    Embeds the question, runs a cosine-similarity search against
    knowledge_chunks, and returns the top-k results concatenated into a
    single context string for the LLM to reason over.

    Args:
        client_id: The client's UUID string (ensures tenant isolation).
        question: The caller's question as a natural-language string.
        top_k: Number of chunks to retrieve.

    Returns:
        A concatenated string of relevant knowledge, or an empty string if
        no chunks are found or the query fails.
    """
    try:
        question_vector = await embed_text(question)
    except openai.OpenAIError as exc:
        logger.error("Failed to embed question", client_id=client_id, error=str(exc))
        return ""

    supabase = get_supabase()
    try:
        # Primary path: Supabase pgvector RPC with cosine similarity
        result = supabase.rpc(
            "match_knowledge_chunks",
            {
                "query_embedding": question_vector,
                "match_client_id": client_id,
                "match_count": top_k,
            },
        ).execute()

        if not result.data:
            return ""

        context_parts = [row["content"] for row in result.data if row.get("content")]
        return "\n".join(context_parts)

    except Exception as exc:
        # Fallback: fetch all chunks for this client, rank locally by cosine similarity.
        # Works without any SQL function — viable for small knowledge bases (<200 chunks).
        logger.warning(
            "RPC match_knowledge_chunks failed, falling back to local ranking",
            client_id=client_id,
            error=str(exc),
        )
        try:
            all_chunks = (
                supabase.table("knowledge_chunks")
                .select("content, embedding")
                .eq("client_id", client_id)
                .execute()
            )
            if not all_chunks.data:
                return ""

            # Local cosine similarity (dot product on unit vectors).
            # Supabase returns pgvector fields as a string "[-0.1,0.2,...]"
            # — parse it to a float list first.
            def _parse_vector(v: list[float] | str) -> list[float]:
                if isinstance(v, str):
                    return [float(x) for x in v.strip("[]").split(",")]
                return [float(x) for x in v]

            def cosine_similarity(a: list[float], b_raw: list[float] | str) -> float:
                b = _parse_vector(b_raw)
                dot = sum(x * y for x, y in zip(a, b))
                norm_a = sum(x * x for x in a) ** 0.5
                norm_b = sum(x * x for x in b) ** 0.5
                if norm_a == 0 or norm_b == 0:
                    return 0.0
                return dot / (norm_a * norm_b)

            ranked = sorted(
                all_chunks.data,
                key=lambda row: cosine_similarity(question_vector, row["embedding"]),
                reverse=True,
            )
            top = ranked[:top_k]
            context_parts = [row["content"] for row in top if row.get("content")]
            return "\n".join(context_parts)

        except Exception as exc2:
            logger.error(
                "RAG query failed completely",
                client_id=client_id,
                error=str(exc2),
            )
            return ""
