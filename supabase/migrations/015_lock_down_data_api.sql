-- Phase 2/2: remove plaintext Agent keys and close direct Data API access.
-- Apply only after the hash-based server code has been deployed successfully.

begin;

do $$
begin
  if exists (select 1 from public.ai_agents where api_key_hash is null) then
    raise exception 'Cannot enforce api_key_hash: one or more agents have no hash';
  end if;
end
$$;

drop trigger if exists sync_agent_api_key_hash on public.ai_agents;
drop function if exists public.sync_agent_api_key_hash();

-- Keep the RPC contract stable for the deployed server, but stop persisting
-- plaintext before removing the legacy column.
create or replace function public.set_agent_api_key(
  target_agent_id uuid,
  raw_api_key text
)
returns void
language sql
set search_path = public
as $$
  update ai_agents
  set api_key_hash = encode(extensions.digest($2, 'sha256'), 'hex')
  where id = $1;
$$;

alter table public.ai_agents
  alter column api_key_hash set not null,
  drop column if exists api_key;

create or replace function public.increment_counter(
  row_id uuid,
  col text,
  delta integer
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if col not in ('likes', 'collects') then
    raise exception 'Column not allowed: %', col;
  end if;
  execute format(
    'update posts set %I = greatest(0, %I + $1) where id = $2',
    col,
    col
  ) using delta, row_id;
end;
$$;

create or replace function public.increment_agent_karma(
  agent_id uuid,
  delta integer
)
returns void
language sql
set search_path = public
as $$
  update ai_agents set karma = greatest(0, karma + $2) where id = $1;
$$;

create or replace function public.increment_comment_likes(
  cid uuid,
  delta integer
)
returns void
language sql
set search_path = public
as $$
  update comments set likes = greatest(0, likes + $2) where id = $1;
$$;

-- Remove every existing RLS policy from application tables. The Next.js API
-- is the sole data gateway and uses a server-only service key.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'ai_agents',
        'organizations',
        'agent_role_bindings',
        'posts',
        'comments',
        'post_reactions',
        'comment_reactions',
        'follows',
        'knowledge_chunks'
      ])
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$$;

revoke all on table
  public.ai_agents,
  public.organizations,
  public.agent_role_bindings,
  public.posts,
  public.comments,
  public.post_reactions,
  public.comment_reactions,
  public.follows,
  public.knowledge_chunks
from public, anon, authenticated;

revoke usage on schema public from public, anon, authenticated;

revoke execute on function public.increment_counter(uuid, text, integer)
  from public, anon, authenticated;
revoke execute on function public.increment_agent_karma(uuid, integer)
  from public, anon, authenticated;
revoke execute on function public.increment_comment_likes(uuid, integer)
  from public, anon, authenticated;
revoke execute on function public.match_knowledge_chunks(vector, integer, double precision)
  from public, anon, authenticated;
revoke execute on function public.set_agent_api_key(uuid, text)
  from public, anon, authenticated;

grant usage on schema public to service_role;
grant all on table
  public.ai_agents,
  public.organizations,
  public.agent_role_bindings,
  public.posts,
  public.comments,
  public.post_reactions,
  public.comment_reactions,
  public.follows,
  public.knowledge_chunks
to service_role;
grant execute on function public.increment_counter(uuid, text, integer)
  to service_role;
grant execute on function public.increment_agent_karma(uuid, integer)
  to service_role;
grant execute on function public.increment_comment_likes(uuid, integer)
  to service_role;
grant execute on function public.match_knowledge_chunks(vector, integer, double precision)
  to service_role;
grant execute on function public.set_agent_api_key(uuid, text)
  to service_role;

alter default privileges in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;

commit;
