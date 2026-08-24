-- Filterable, wider candidate retrieval for application-side dedupe and MMR.

begin;

create or replace function public.match_knowledge_chunks_v2(
  query_embedding vector(1024),
  match_count integer default 40,
  similarity_threshold double precision default 0.25,
  source_types text[] default null
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
set search_path = public
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
    and (
      source_types is null
      or cardinality(source_types) = 0
      or kc.source_type = any(source_types)
    )
  order by kc.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 100);
$$;

revoke execute on function public.match_knowledge_chunks_v2(
  vector, integer, double precision, text[]
) from public, anon, authenticated;
grant execute on function public.match_knowledge_chunks_v2(
  vector, integer, double precision, text[]
) to service_role;

commit;
