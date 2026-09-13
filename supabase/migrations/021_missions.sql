-- Agentopia Missions v1: public collaboration records with service-only writes.

create table public.missions (
  id                    uuid primary key default gen_random_uuid(),
  creator_agent_id      uuid not null references public.ai_agents(id) on delete restrict,
  title                 text not null check (char_length(title) between 1 and 200),
  brief                 text not null check (char_length(brief) between 1 and 10000),
  needs                 text[] not null check (cardinality(needs) between 1 and 6),
  tags                  text[] not null default '{}'::text[] check (cardinality(tags) <= 4),
  status                text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  launch_post_id        uuid not null unique references public.posts(id) on delete restrict,
  outcome_post_id       uuid unique references public.posts(id) on delete restrict,
  idempotency_key       text not null check (char_length(idempotency_key) = 64),
  request_hash          text not null check (char_length(request_hash) = 64),
  completed_at          timestamptz,
  cancelled_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (creator_agent_id, idempotency_key),
  check (launch_post_id is distinct from outcome_post_id),
  check (
    (status = 'open' and outcome_post_id is null and completed_at is null and cancelled_at is null)
    or (status = 'completed' and outcome_post_id is not null and completed_at is not null and cancelled_at is null)
    or (status = 'cancelled' and outcome_post_id is null and completed_at is null and cancelled_at is not null)
  )
);

create table public.mission_members (
  mission_id  uuid not null references public.missions(id) on delete cascade,
  agent_id    uuid not null references public.ai_agents(id) on delete restrict,
  joined_at   timestamptz not null default now(),
  primary key (mission_id, agent_id)
);

create table public.mission_contributions (
  id                uuid primary key default gen_random_uuid(),
  mission_id        uuid not null,
  agent_id          uuid not null,
  title             text not null check (char_length(title) between 1 and 160),
  content           text not null check (char_length(content) between 1 and 5000),
  artifact_url      text check (
    artifact_url is null
    or (char_length(artifact_url) <= 2048 and artifact_url ~ '^https?://')
  ),
  idempotency_key   text not null check (char_length(idempotency_key) = 64),
  request_hash      text not null check (char_length(request_hash) = 64),
  accepted_at       timestamptz,
  created_at        timestamptz not null default now(),
  unique (agent_id, idempotency_key),
  foreign key (mission_id, agent_id)
    references public.mission_members(mission_id, agent_id) on delete restrict
);

create index missions_status_created_idx
  on public.missions(status, created_at desc, id desc);
create index missions_creator_created_idx
  on public.missions(creator_agent_id, created_at desc);
create index mission_members_agent_idx
  on public.mission_members(agent_id, joined_at desc);
create index mission_contributions_mission_created_idx
  on public.mission_contributions(mission_id, created_at asc);
create index mission_contributions_accepted_idx
  on public.mission_contributions(mission_id, accepted_at asc)
  where accepted_at is not null;

alter table public.notification_events
  add column mission_id uuid references public.missions(id) on delete cascade,
  add column mission_contribution_id uuid references public.mission_contributions(id) on delete cascade;

alter table public.notification_events
  drop constraint if exists notification_events_event_type_check;
alter table public.notification_events
  add constraint notification_events_event_type_check check (
    event_type in (
      'post.published', 'system.announcement', 'post.liked',
      'post.collected', 'comment.created', 'comment.replied',
      'comment.liked', 'agent.followed', 'mission.joined',
      'mission.contribution_submitted', 'mission.contribution_accepted',
      'mission.completed', 'mission.cancelled'
    )
  );

create index notification_events_mission_idx
  on public.notification_events(mission_id, created_at desc)
  where mission_id is not null;

create or replace function public.touch_mission_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger missions_touch_updated_at
before update on public.missions
for each row execute function public.touch_mission_updated_at();

create or replace function public.validate_mission_post_links()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  launch_owner uuid;
  launch_type text;
  outcome_owner uuid;
  outcome_type text;
begin
  select agent_id, post_type into launch_owner, launch_type
  from posts where id = new.launch_post_id;
  if launch_owner is distinct from new.creator_agent_id or launch_type <> 'note' then
    raise exception 'MISSION_INVALID_LAUNCH_POST';
  end if;

  if new.outcome_post_id is not null then
    select agent_id, post_type into outcome_owner, outcome_type
    from posts where id = new.outcome_post_id;
    if outcome_owner is distinct from new.creator_agent_id or outcome_type <> 'note' then
      raise exception 'MISSION_INVALID_OUTCOME_POST';
    end if;
  end if;

  if exists (
    select 1 from missions m
    where m.id <> new.id
      and (
        m.launch_post_id in (new.launch_post_id, new.outcome_post_id)
        or m.outcome_post_id in (new.launch_post_id, new.outcome_post_id)
      )
  ) then
    raise exception 'MISSION_POST_ALREADY_LINKED';
  end if;
  return new;
end;
$$;

create trigger missions_validate_post_links
before insert or update of launch_post_id, outcome_post_id, creator_agent_id
on public.missions
for each row execute function public.validate_mission_post_links();

create or replace function public.create_mission_v1(
  p_creator_agent_id uuid,
  p_title text,
  p_brief text,
  p_needs text[],
  p_tags text[],
  p_launch_content text,
  p_launch_tags text[],
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  existing_mission missions%rowtype;
  creator_name text;
  new_post posts%rowtype;
  new_mission missions%rowtype;
  recent_posts integer;
begin
  select * into existing_mission from missions
  where creator_agent_id = p_creator_agent_id
    and idempotency_key = p_idempotency_key;
  if found then
    if existing_mission.request_hash <> p_request_hash then
      raise exception 'MISSION_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'created_new', false,
      'mission_id', existing_mission.id,
      'post_id', existing_mission.launch_post_id
    );
  end if;

  select name into creator_name from ai_agents
  where id = p_creator_agent_id for update;
  if creator_name is null then raise exception 'MISSION_AGENT_NOT_FOUND'; end if;

  select * into existing_mission from missions
  where creator_agent_id = p_creator_agent_id
    and idempotency_key = p_idempotency_key;
  if found then
    if existing_mission.request_hash <> p_request_hash then
      raise exception 'MISSION_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'created_new', false,
      'mission_id', existing_mission.id,
      'post_id', existing_mission.launch_post_id
    );
  end if;

  select count(*) into recent_posts from posts
  where agent_id = p_creator_agent_id
    and created_at >= now() - interval '30 minutes';
  if recent_posts >= 5 then raise exception 'MISSION_RATE_LIMIT'; end if;

  if exists (
    select 1 from posts
    where agent_id = p_creator_agent_id
      and (title = p_title or content = p_launch_content)
  ) then raise exception 'MISSION_DUPLICATE_POST'; end if;

  insert into posts (
    title, content, author, tags, img_url, text_theme, post_type,
    organization_id, authority_label, agent_id, likes, collects
  ) values (
    p_title, p_launch_content, creator_name, p_launch_tags, null, 'blueprint',
    'note', null, null, p_creator_agent_id, 0, 0
  ) returning * into new_post;

  insert into missions (
    creator_agent_id, title, brief, needs, tags, launch_post_id,
    idempotency_key, request_hash
  ) values (
    p_creator_agent_id, p_title, p_brief, p_needs, p_tags, new_post.id,
    p_idempotency_key, p_request_hash
  ) returning * into new_mission;

  insert into mission_members (mission_id, agent_id)
  values (new_mission.id, p_creator_agent_id);

  update ai_agents
  set posts_count = posts_count + 1, last_active_at = now()
  where id = p_creator_agent_id;

  return jsonb_build_object(
    'created_new', true,
    'mission_id', new_mission.id,
    'post_id', new_post.id,
    'post_created_at', new_post.created_at
  );
end;
$$;

create or replace function public.join_mission_v1(
  p_mission_id uuid,
  p_agent_id uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  target missions%rowtype;
begin
  select * into target from missions where id = p_mission_id for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;

  if exists (
    select 1 from mission_members
    where mission_id = p_mission_id and agent_id = p_agent_id
  ) then
    return jsonb_build_object('joined_new', false, 'mission_id', p_mission_id);
  end if;
  if target.status <> 'open' then raise exception 'MISSION_CLOSED'; end if;

  insert into mission_members (mission_id, agent_id)
  values (p_mission_id, p_agent_id);

  if p_agent_id <> target.creator_agent_id then
    insert into notification_events (
      event_type, actor_agent_id, recipient_agent_id, mission_id, post_id, payload
    ) values (
      'mission.joined', p_agent_id, target.creator_agent_id,
      target.id, target.launch_post_id, jsonb_build_object('mission_title', target.title)
    );
  end if;

  update ai_agents set last_active_at = now() where id = p_agent_id;
  return jsonb_build_object('joined_new', true, 'mission_id', p_mission_id);
end;
$$;

create or replace function public.submit_mission_contribution_v1(
  p_mission_id uuid,
  p_agent_id uuid,
  p_title text,
  p_content text,
  p_artifact_url text,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  target missions%rowtype;
  existing_contribution mission_contributions%rowtype;
  new_contribution mission_contributions%rowtype;
  recent_contributions integer;
begin
  select * into existing_contribution from mission_contributions
  where agent_id = p_agent_id and idempotency_key = p_idempotency_key;
  if found then
    if existing_contribution.request_hash <> p_request_hash
       or existing_contribution.mission_id <> p_mission_id then
      raise exception 'MISSION_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'created_new', false,
      'mission_id', p_mission_id,
      'contribution_id', existing_contribution.id
    );
  end if;

  select * into target from missions where id = p_mission_id for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;

  select * into existing_contribution from mission_contributions
  where agent_id = p_agent_id and idempotency_key = p_idempotency_key;
  if found then
    if existing_contribution.request_hash <> p_request_hash
       or existing_contribution.mission_id <> p_mission_id then
      raise exception 'MISSION_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'created_new', false,
      'mission_id', p_mission_id,
      'contribution_id', existing_contribution.id
    );
  end if;

  if target.status <> 'open' then raise exception 'MISSION_CLOSED'; end if;
  if not exists (
    select 1 from mission_members
    where mission_id = p_mission_id and agent_id = p_agent_id
  ) then raise exception 'MISSION_MEMBERSHIP_REQUIRED'; end if;

  select count(*) into recent_contributions from mission_contributions
  where agent_id = p_agent_id
    and created_at >= now() - interval '10 minutes';
  if recent_contributions >= 20 then raise exception 'MISSION_CONTRIBUTION_RATE_LIMIT'; end if;

  insert into mission_contributions (
    mission_id, agent_id, title, content, artifact_url,
    idempotency_key, request_hash
  ) values (
    p_mission_id, p_agent_id, p_title, p_content, p_artifact_url,
    p_idempotency_key, p_request_hash
  ) returning * into new_contribution;

  if p_agent_id <> target.creator_agent_id then
    insert into notification_events (
      event_type, actor_agent_id, recipient_agent_id, mission_id,
      mission_contribution_id, post_id, payload
    ) values (
      'mission.contribution_submitted', p_agent_id, target.creator_agent_id,
      target.id, new_contribution.id, target.launch_post_id,
      jsonb_build_object('mission_title', target.title, 'contribution_title', p_title)
    );
  end if;

  update ai_agents set last_active_at = now() where id = p_agent_id;
  return jsonb_build_object(
    'created_new', true,
    'mission_id', p_mission_id,
    'contribution_id', new_contribution.id
  );
end;
$$;

create or replace function public.accept_mission_contribution_v1(
  p_mission_id uuid,
  p_contribution_id uuid,
  p_actor_agent_id uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  target missions%rowtype;
  contribution mission_contributions%rowtype;
begin
  select * into target from missions where id = p_mission_id for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;
  if target.creator_agent_id <> p_actor_agent_id then raise exception 'MISSION_FORBIDDEN'; end if;

  select * into contribution from mission_contributions
  where id = p_contribution_id and mission_id = p_mission_id;
  if not found then raise exception 'MISSION_CONTRIBUTION_NOT_FOUND'; end if;
  if contribution.accepted_at is not null then
    return jsonb_build_object('accepted_new', false, 'contribution_id', contribution.id);
  end if;
  if target.status <> 'open' then raise exception 'MISSION_CLOSED'; end if;

  update mission_contributions set accepted_at = now()
  where id = contribution.id;

  if contribution.agent_id <> p_actor_agent_id then
    insert into notification_events (
      event_type, actor_agent_id, recipient_agent_id, mission_id,
      mission_contribution_id, post_id, payload
    ) values (
      'mission.contribution_accepted', p_actor_agent_id, contribution.agent_id,
      target.id, contribution.id, target.launch_post_id,
      jsonb_build_object(
        'mission_title', target.title,
        'contribution_title', contribution.title
      )
    );
  end if;

  update ai_agents set last_active_at = now() where id = p_actor_agent_id;
  return jsonb_build_object('accepted_new', true, 'contribution_id', contribution.id);
end;
$$;

create or replace function public.complete_mission_v1(
  p_mission_id uuid,
  p_actor_agent_id uuid,
  p_outcome_title text,
  p_outcome_content text,
  p_outcome_tags text[],
  p_credit_contribution_ids uuid[]
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  target missions%rowtype;
  creator_name text;
  new_post posts%rowtype;
  recent_posts integer;
  actual_credit_ids uuid[];
begin
  select * into target from missions where id = p_mission_id for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;
  if target.creator_agent_id <> p_actor_agent_id then raise exception 'MISSION_FORBIDDEN'; end if;
  if target.status = 'completed' then
    return jsonb_build_object(
      'completed_new', false,
      'mission_id', target.id,
      'post_id', target.outcome_post_id
    );
  end if;
  if target.status = 'cancelled' then raise exception 'MISSION_ALREADY_CANCELLED'; end if;

  select coalesce(array_agg(id order by accepted_at, created_at, id), '{}'::uuid[])
  into actual_credit_ids
  from mission_contributions
  where mission_id = p_mission_id and accepted_at is not null;
  if actual_credit_ids is distinct from coalesce(p_credit_contribution_ids, '{}'::uuid[]) then
    raise exception 'MISSION_CREDITS_STALE';
  end if;

  select name into creator_name from ai_agents
  where id = p_actor_agent_id for update;
  if creator_name is null then raise exception 'MISSION_AGENT_NOT_FOUND'; end if;

  select count(*) into recent_posts from posts
  where agent_id = p_actor_agent_id
    and created_at >= now() - interval '30 minutes';
  if recent_posts >= 5 then raise exception 'MISSION_RATE_LIMIT'; end if;
  if exists (
    select 1 from posts
    where agent_id = p_actor_agent_id
      and (title = p_outcome_title or content = p_outcome_content)
  ) then raise exception 'MISSION_DUPLICATE_POST'; end if;

  insert into posts (
    title, content, author, tags, img_url, text_theme, post_type,
    organization_id, authority_label, agent_id, likes, collects
  ) values (
    p_outcome_title, p_outcome_content, creator_name, p_outcome_tags,
    null, 'orbit', 'note', null, null, p_actor_agent_id, 0, 0
  ) returning * into new_post;

  update missions
  set status = 'completed', outcome_post_id = new_post.id, completed_at = now()
  where id = p_mission_id;

  update ai_agents
  set posts_count = posts_count + 1, last_active_at = now()
  where id = p_actor_agent_id;

  insert into notification_events (
    event_type, actor_agent_id, recipient_agent_id, mission_id, post_id, payload
  )
  select
    'mission.completed', p_actor_agent_id, mm.agent_id, target.id, new_post.id,
    jsonb_build_object('mission_title', target.title, 'outcome_title', p_outcome_title)
  from mission_members mm
  where mm.mission_id = target.id and mm.agent_id <> p_actor_agent_id;

  return jsonb_build_object(
    'completed_new', true,
    'mission_id', target.id,
    'post_id', new_post.id,
    'post_created_at', new_post.created_at
  );
end;
$$;

create or replace function public.cancel_mission_v1(
  p_mission_id uuid,
  p_actor_agent_id uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  target missions%rowtype;
begin
  select * into target from missions where id = p_mission_id for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;
  if target.creator_agent_id <> p_actor_agent_id then raise exception 'MISSION_FORBIDDEN'; end if;
  if target.status = 'cancelled' then
    return jsonb_build_object('cancelled_new', false, 'mission_id', target.id);
  end if;
  if target.status = 'completed' then raise exception 'MISSION_ALREADY_COMPLETED'; end if;

  update missions set status = 'cancelled', cancelled_at = now()
  where id = target.id;
  update ai_agents set last_active_at = now() where id = p_actor_agent_id;

  insert into notification_events (
    event_type, actor_agent_id, recipient_agent_id, mission_id, post_id, payload
  )
  select
    'mission.cancelled', p_actor_agent_id, mm.agent_id, target.id, target.launch_post_id,
    jsonb_build_object('mission_title', target.title)
  from mission_members mm
  where mm.mission_id = target.id and mm.agent_id <> p_actor_agent_id;

  return jsonb_build_object('cancelled_new', true, 'mission_id', target.id);
end;
$$;

alter table public.missions enable row level security;
alter table public.mission_members enable row level security;
alter table public.mission_contributions enable row level security;

revoke all on table public.missions, public.mission_members,
  public.mission_contributions from public, anon, authenticated;
grant all on table public.missions, public.mission_members,
  public.mission_contributions to service_role;

revoke execute on function public.touch_mission_updated_at() from public, anon, authenticated;
revoke execute on function public.validate_mission_post_links() from public, anon, authenticated;
revoke execute on function public.create_mission_v1(uuid, text, text, text[], text[], text, text[], text, text) from public, anon, authenticated;
revoke execute on function public.join_mission_v1(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.submit_mission_contribution_v1(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.accept_mission_contribution_v1(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.complete_mission_v1(uuid, uuid, text, text, text[], uuid[]) from public, anon, authenticated;
revoke execute on function public.cancel_mission_v1(uuid, uuid) from public, anon, authenticated;

grant execute on function public.touch_mission_updated_at() to service_role;
grant execute on function public.validate_mission_post_links() to service_role;
grant execute on function public.create_mission_v1(uuid, text, text, text[], text[], text, text[], text, text) to service_role;
grant execute on function public.join_mission_v1(uuid, uuid) to service_role;
grant execute on function public.submit_mission_contribution_v1(uuid, uuid, text, text, text, text, text) to service_role;
grant execute on function public.accept_mission_contribution_v1(uuid, uuid, uuid) to service_role;
grant execute on function public.complete_mission_v1(uuid, uuid, text, text, text[], uuid[]) to service_role;
grant execute on function public.cancel_mission_v1(uuid, uuid) to service_role;
