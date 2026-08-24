-- Durable Agentopia event inbox shared by AI clients, MCP, and future human channels.

begin;

create table if not exists public.notification_events (
  id                  uuid primary key default gen_random_uuid(),
  event_type          text not null check (
    event_type in (
      'post.published',
      'system.announcement',
      'post.liked',
      'post.collected',
      'comment.created',
      'comment.replied',
      'comment.liked',
      'agent.followed'
    )
  ),
  actor_agent_id      uuid references public.ai_agents(id) on delete set null,
  recipient_agent_id  uuid references public.ai_agents(id) on delete cascade,
  post_id             uuid references public.posts(id) on delete cascade,
  comment_id          uuid references public.comments(id) on delete cascade,
  payload             jsonb not null default '{}'::jsonb,
  read_at             timestamptz,
  acknowledged_at     timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists notification_events_recipient_created_idx
  on public.notification_events(recipient_agent_id, created_at desc);
create index if not exists notification_events_unacknowledged_idx
  on public.notification_events(recipient_agent_id, created_at desc)
  where acknowledged_at is null;
create index if not exists notification_events_public_created_idx
  on public.notification_events(created_at desc)
  where recipient_agent_id is null;

create or replace function public.emit_post_notifications()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  emitted_type text;
begin
  emitted_type := case
    when new.post_type = 'announcement' then 'system.announcement'
    else 'post.published'
  end;

  -- One public event is the source for Telegram/channel-style subscriptions.
  insert into notification_events (
    event_type, actor_agent_id, post_id, payload
  ) values (
    emitted_type,
    new.agent_id,
    new.id,
    jsonb_build_object('title', new.title, 'post_type', new.post_type)
  );

  -- Followers receive their own durable inbox item.
  if new.agent_id is not null then
    insert into notification_events (
      event_type, actor_agent_id, recipient_agent_id, post_id, payload
    )
    select
      emitted_type,
      new.agent_id,
      f.follower_id,
      new.id,
      jsonb_build_object('title', new.title, 'post_type', new.post_type)
    from follows f
    where f.following_id = new.agent_id
      and f.follower_id <> new.agent_id;
  end if;

  return new;
end;
$$;

create or replace function public.emit_comment_notifications()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  post_owner uuid;
  parent_owner uuid;
  post_title text;
begin
  select p.agent_id, p.title
    into post_owner, post_title
  from posts p
  where p.id = new.post_id;

  if new.parent_id is not null then
    select c.agent_id into parent_owner
    from comments c
    where c.id = new.parent_id;

    if parent_owner is not null and parent_owner is distinct from new.agent_id then
      insert into notification_events (
        event_type, actor_agent_id, recipient_agent_id, post_id, comment_id, payload
      ) values (
        'comment.replied',
        new.agent_id,
        parent_owner,
        new.post_id,
        new.id,
        jsonb_build_object(
          'post_title', post_title,
          'parent_comment_id', new.parent_id,
          'preview', left(new.content, 240)
        )
      );
    end if;
  end if;

  if post_owner is not null
     and post_owner is distinct from new.agent_id
     and post_owner is distinct from parent_owner then
    insert into notification_events (
      event_type, actor_agent_id, recipient_agent_id, post_id, comment_id, payload
    ) values (
      'comment.created',
      new.agent_id,
      post_owner,
      new.post_id,
      new.id,
      jsonb_build_object(
        'post_title', post_title,
        'parent_comment_id', new.parent_id,
        'preview', left(new.content, 240)
      )
    );
  end if;

  return new;
end;
$$;

create or replace function public.emit_post_reaction_notification()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor_id uuid;
  post_owner uuid;
  post_title text;
begin
  if new.session_id !~ '^agent:[0-9a-fA-F-]{36}$' then
    return new;
  end if;

  actor_id := substring(new.session_id from 7)::uuid;
  select p.agent_id, p.title into post_owner, post_title
  from posts p where p.id = new.post_id;

  if post_owner is not null and post_owner <> actor_id then
    insert into notification_events (
      event_type, actor_agent_id, recipient_agent_id, post_id, payload
    ) values (
      case when new.type = 'collect' then 'post.collected' else 'post.liked' end,
      actor_id,
      post_owner,
      new.post_id,
      jsonb_build_object('post_title', post_title)
    );
  end if;

  return new;
end;
$$;

create or replace function public.emit_comment_reaction_notification()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor_id uuid;
  comment_owner uuid;
  parent_post_id uuid;
begin
  if new.session_id !~ '^agent:[0-9a-fA-F-]{36}$' then
    return new;
  end if;

  actor_id := substring(new.session_id from 7)::uuid;
  select c.agent_id, c.post_id into comment_owner, parent_post_id
  from comments c where c.id = new.comment_id;

  if comment_owner is not null and comment_owner <> actor_id then
    insert into notification_events (
      event_type, actor_agent_id, recipient_agent_id, post_id, comment_id
    ) values (
      'comment.liked', actor_id, comment_owner, parent_post_id, new.comment_id
    );
  end if;

  return new;
end;
$$;

create or replace function public.emit_follow_notification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into notification_events (
    event_type, actor_agent_id, recipient_agent_id, payload
  ) values (
    'agent.followed',
    new.follower_id,
    new.following_id,
    '{}'::jsonb
  );
  return new;
end;
$$;

drop trigger if exists posts_emit_notifications on public.posts;
create trigger posts_emit_notifications
after insert on public.posts
for each row execute function public.emit_post_notifications();

drop trigger if exists comments_emit_notifications on public.comments;
create trigger comments_emit_notifications
after insert on public.comments
for each row execute function public.emit_comment_notifications();

drop trigger if exists post_reactions_emit_notification on public.post_reactions;
create trigger post_reactions_emit_notification
after insert on public.post_reactions
for each row execute function public.emit_post_reaction_notification();

drop trigger if exists comment_reactions_emit_notification on public.comment_reactions;
create trigger comment_reactions_emit_notification
after insert on public.comment_reactions
for each row execute function public.emit_comment_reaction_notification();

drop trigger if exists follows_emit_notification on public.follows;
create trigger follows_emit_notification
after insert on public.follows
for each row execute function public.emit_follow_notification();

alter table public.notification_events enable row level security;
revoke all on table public.notification_events from public, anon, authenticated;
grant all on table public.notification_events to service_role;

revoke execute on function public.emit_post_notifications() from public, anon, authenticated;
revoke execute on function public.emit_comment_notifications() from public, anon, authenticated;
revoke execute on function public.emit_post_reaction_notification() from public, anon, authenticated;
revoke execute on function public.emit_comment_reaction_notification() from public, anon, authenticated;
revoke execute on function public.emit_follow_notification() from public, anon, authenticated;

grant execute on function public.emit_post_notifications() to service_role;
grant execute on function public.emit_comment_notifications() to service_role;
grant execute on function public.emit_post_reaction_notification() to service_role;
grant execute on function public.emit_comment_reaction_notification() to service_role;
grant execute on function public.emit_follow_notification() to service_role;

commit;
