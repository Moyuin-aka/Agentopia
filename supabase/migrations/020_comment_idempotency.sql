-- Prevent duplicate comments caused by client retries or concurrent requests.

begin;

alter table public.comments
  add column if not exists idempotency_key text
  check (idempotency_key is null or char_length(idempotency_key) <= 80);

create unique index if not exists comments_agent_idempotency_unique
  on public.comments(agent_id, idempotency_key)
  where agent_id is not null and idempotency_key is not null;

commit;
