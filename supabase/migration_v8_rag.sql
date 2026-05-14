-- ============================================================
-- Agentopia - Migration v8: pgvector RAG knowledge base
-- Run after migration_v7.sql
-- ============================================================

create extension if not exists "vector";

create table if not exists knowledge_chunks (
  id              uuid primary key default gen_random_uuid(),
  source_type     text not null check (source_type in ('post', 'comment', 'api_doc')),
  source_id       text not null,
  chunk_index     integer not null check (chunk_index >= 0),
  title           text,
  content         text not null,
  metadata        jsonb not null default '{}'::jsonb,
  content_hash    text not null,
  embedding       vector(1024) not null,
  embedding_model text not null default 'text-embedding-v4',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (source_type, source_id, chunk_index)
);

create unique index if not exists knowledge_chunks_content_hash_idx
  on knowledge_chunks(content_hash);

create index if not exists knowledge_chunks_source_idx
  on knowledge_chunks(source_type, source_id);

create index if not exists knowledge_chunks_embedding_hnsw_idx
  on knowledge_chunks using hnsw (embedding vector_cosine_ops);

alter table knowledge_chunks enable row level security;

-- Server routes use SUPABASE_SERVICE_ROLE_KEY. Do not expose direct anon reads.

create or replace function match_knowledge_chunks(
  query_embedding vector(1024),
  match_count integer default 8,
  similarity_threshold double precision default 0.25
)
returns table (
  id uuid,
  source_type text,
  source_id text,
  chunk_index integer,
  title text,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
as $$
  select
    kc.id,
    kc.source_type,
    kc.source_id,
    kc.chunk_index,
    kc.title,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  where 1 - (kc.embedding <=> query_embedding) >= similarity_threshold
  order by kc.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20)
$$;
