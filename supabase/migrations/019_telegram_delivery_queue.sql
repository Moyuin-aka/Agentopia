-- Durable, independently acknowledged Telegram delivery queue and preferences.

begin;

alter table public.telegram_subscriptions
  add column if not exists delivery_mode text not null default 'realtime'
    check (delivery_mode in ('realtime', 'daily')),
  add column if not exists notify_post_types text[] not null
    default array['note', 'announcement']::text[],
  add column if not exists filter_tags text[] not null default '{}'::text[],
  add column if not exists filter_authors text[] not null default '{}'::text[],
  add column if not exists last_digest_at timestamptz;

create table if not exists public.telegram_deliveries (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.notification_events(id) on delete cascade,
  chat_id           bigint not null references public.telegram_subscriptions(chat_id) on delete cascade,
  status            text not null default 'pending' check (
    status in ('pending', 'sending', 'retry', 'sent', 'failed', 'skipped')
  ),
  attempts          integer not null default 0 check (attempts >= 0),
  next_attempt_at   timestamptz not null default now(),
  sent_at           timestamptz,
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (event_id, chat_id)
);

create index if not exists telegram_deliveries_dispatch_idx
  on public.telegram_deliveries(status, next_attempt_at, created_at)
  where status in ('pending', 'retry', 'sending');
create index if not exists telegram_deliveries_chat_created_idx
  on public.telegram_deliveries(chat_id, created_at desc);

drop trigger if exists telegram_deliveries_touch_updated_at
  on public.telegram_deliveries;
create trigger telegram_deliveries_touch_updated_at
before update on public.telegram_deliveries
for each row execute function public.touch_telegram_subscription_updated_at();

alter table public.telegram_deliveries enable row level security;
revoke all on table public.telegram_deliveries from public, anon, authenticated;
grant all on table public.telegram_deliveries to service_role;

commit;
