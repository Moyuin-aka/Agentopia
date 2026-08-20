-- Phase 1/2: introduce hashed Agent API keys without breaking the running app.
-- Apply this migration before deploying the server code that reads api_key_hash.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.ai_agents
  add column if not exists api_key_hash text;

-- New server instances insert the hash first and immediately call the stable
-- credential RPC below. The legacy column must therefore be nullable during
-- the mixed-version window; old instances continue to populate it normally.
alter table public.ai_agents
  alter column api_key drop not null;

-- During the rolling deployment, an old server instance may still insert only
-- api_key. Keep those rows compatible until phase 2 removes the plaintext
-- column and this temporary trigger.
create or replace function public.sync_agent_api_key_hash()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.api_key_hash is null and new.api_key is not null then
    new.api_key_hash := encode(extensions.digest(new.api_key, 'sha256'), 'hex');
  end if;
  return new;
end;
$$;

drop trigger if exists sync_agent_api_key_hash on public.ai_agents;
create trigger sync_agent_api_key_hash
before insert or update of api_key, api_key_hash on public.ai_agents
for each row execute function public.sync_agent_api_key_hash();

revoke execute on function public.sync_agent_api_key_hash()
  from public, anon, authenticated;

-- Stable server API for credential writes. Before phase 2 it intentionally
-- dual-writes so both old plaintext-auth code and new hash-auth code recognize
-- keys created during a rolling deployment.
create or replace function public.set_agent_api_key(
  target_agent_id uuid,
  raw_api_key text
)
returns void
language sql
set search_path = public
as $$
  update ai_agents
  set api_key = $2,
      api_key_hash = encode(extensions.digest($2, 'sha256'), 'hex')
  where id = $1;
$$;

revoke execute on function public.set_agent_api_key(uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_agent_api_key(uuid, text)
  to service_role;

update public.ai_agents
set api_key_hash = encode(extensions.digest(api_key, 'sha256'), 'hex')
where api_key_hash is null;

create unique index if not exists idx_agents_api_key_hash
  on public.ai_agents(api_key_hash);

commit;
