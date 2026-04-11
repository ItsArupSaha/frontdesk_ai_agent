# Phase 3 — RAG Knowledge Base + Call Summaries

## Goal
The agent gives accurate, business-specific answers instead of generic ones.
"Do you fix tankless water heaters?" gets a real yes/no from that business's
knowledge base. Call summaries are auto-generated and stored after every call.

---

## New dependency
```
pgvector  (already available in Supabase — enable the extension)
openai==1.30.0  (for text-embedding-3-small embeddings — cheaper than Anthropic)
```
NOTE: We use OpenAI embeddings only. Claude still handles all reasoning.
Add OPENAI_API_KEY to .env.example (embeddings only, ~$0.0001 per query).

---

## New files to create

### backend/db/migrations/003_knowledge_base.sql
```sql
-- Enable pgvector
create extension if not exists vector;

-- Knowledge base chunks per client
create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  content text not null,
  embedding vector(1536),
  category text,  -- 'services', 'pricing', 'faq', 'area', 'hours'
  created_at timestamptz not null default now()
);

create index on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
create index on knowledge_chunks(client_id);
```

### backend/services/rag_service.py

`async def embed_text(text: str) -> list[float]`
- Call OpenAI text-embedding-3-small
- Return 1536-dimension vector

`async def ingest_client_knowledge(client_id: str, client_config: dict) -> None`
- Convert client_config into knowledge chunks:
  - One chunk per service offered
  - One chunk for working hours
  - One chunk for service area description
  - One chunk for pricing ranges if available
  - One chunk for business description
- Embed each chunk
- Upsert into knowledge_chunks table
- Called once during client onboarding, and when client updates their settings

`async def query_knowledge(client_id: str, question: str, top_k: int = 3) -> str`
- Embed the question
- Query knowledge_chunks using cosine similarity:
  ```sql
  select content from knowledge_chunks
  where client_id = $1
  order by embedding <=> $2
  limit $3
  ```
- Concatenate top_k results into a context string
- Return context string for Claude to use

### Update backend/agents/tools.py — update get_business_info tool
- Phase 1 used client_config directly
- Now call rag_service.query_knowledge() instead
- The tool becomes genuinely intelligent:
  "Do you fix commercial HVAC?" → RAG finds relevant chunks → Claude answers accurately

### backend/utils/summarizer.py

`async def generate_call_summary(transcript: list[dict], client_config: dict) -> str`
- Use OpenAI gpt-4o-mini to generate a structured summary from the transcript
- Prompt: "Summarize this call in 3-4 sentences. Include:
  what the customer needed, what was resolved or booked, any follow-up needed.
  Be factual and concise."
- Return the summary string

### Update backend/routers/vapi_webhook.py
- On call-ended webhook: call generate_call_summary()
- Store summary in call_logs.summary column
- This gives the client readable call history in dashboard

---

## Tests to write

### tests/test_rag.py (mock OpenAI and Supabase)
- test_ingest_creates_chunks_for_each_service()
- test_query_returns_relevant_content()
- test_query_returns_empty_string_if_no_chunks()
- test_embed_text_returns_1536_dimensions()

### tests/test_summarizer.py (mock Claude)
- test_summary_generated_from_transcript()
- test_summary_handles_empty_transcript()
- test_summary_handles_emergency_call()

---

## Definition of done for Phase 3
- [ ] All previous tests still pass
- [ ] Run ingest for test client → verify chunks in DB
- [ ] Query "do you fix water heaters" → returns relevant chunk
- [ ] get_business_info tool now uses RAG (not raw config)
- [ ] Call summaries stored in DB after call-ended webhook
- [ ] All new tests pass