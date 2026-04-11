-- Phase 3: RAG Knowledge Base
-- Enable pgvector extension (already available in Supabase)
create extension if not exists vector;

-- Knowledge base chunks per client
create table if not exists knowledge_chunks (
  id          uuid        primary key default gen_random_uuid(),
  client_id   uuid        not null references clients(id),
  content     text        not null,
  embedding   vector(1536),
  category    text,  -- 'services', 'pricing', 'faq', 'area', 'hours', 'description'
  created_at  timestamptz not null default now()
);

-- IVFFlat index for fast cosine-similarity search (Supabase supports this)
create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists knowledge_chunks_client_idx
  on knowledge_chunks(client_id);

-- Add summary column to call_logs if it doesn't exist yet
alter table call_logs
  add column if not exists summary text;

-- RPC helper used by rag_service.py for fast cosine similarity search.
-- Run this once in Supabase SQL editor after enabling the vector extension.
create or replace function match_knowledge_chunks(
  query_embedding vector(1536),
  match_client_id uuid,
  match_count     int default 3
)
returns table (content text, similarity float)
language sql stable
as $$
  select content,
         1 - (embedding <=> query_embedding) as similarity
  from knowledge_chunks
  where client_id = match_client_id
  order by embedding <=> query_embedding
  limit match_count;
$$;
