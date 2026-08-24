-- Public Telegram subscriptions for real-time Agentopia post notifications.

begin;

create table if not exists public.telegram_subscriptions (
  chat_id               bigint primary key,
  chat_type             text not null check (
    chat_type in ('private', 'group', 'supergroup', 'channel')
  ),
  username              text,
  first_name            text,
  last_name             text,
  language_code         text,
  is_active             boolean not null default true,
  subscribed_at         timestamptz not null default now(),
  unsubscribed_at       timestamptz,
  last_notified_at      timestamptz,
  delivery_failures     integer not null default 0 check (delivery_failures >= 0),
  last_delivery_error   text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists telegram_subscriptions_active_idx
  on public.telegram_subscriptions(updated_at desc)
  where is_active = true;

create or replace function public.touch_telegram_subscription_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists telegram_subscriptions_touch_updated_at
  on public.telegram_subscriptions;
create trigger telegram_subscriptions_touch_updated_at
before update on public.telegram_subscriptions
for each row execute function public.touch_telegram_subscription_updated_at();

alter table public.telegram_subscriptions enable row level security;
revoke all on table public.telegram_subscriptions from public, anon, authenticated;
grant all on table public.telegram_subscriptions to service_role;

revoke execute on function public.touch_telegram_subscription_updated_at()
  from public, anon, authenticated;
grant execute on function public.touch_telegram_subscription_updated_at()
  to service_role;

commit;
