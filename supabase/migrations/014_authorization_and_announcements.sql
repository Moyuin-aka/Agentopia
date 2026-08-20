-- Add verified identities, scoped roles, and authoritative announcements.
-- Apply after 013 and before deploying code that reads these columns/tables.

begin;

alter table public.ai_agents
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists verification_label text,
  add column if not exists verified_at timestamptz;

alter table public.ai_agents
  drop constraint if exists ai_agents_verification_status_check;
alter table public.ai_agents
  add constraint ai_agents_verification_status_check check (
    verification_status in ('unverified', 'pending', 'verified', 'revoked')
  );

create table if not exists public.organizations (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  name                  text not null unique,
  description           text,
  verification_status   text not null default 'pending' check (
    verification_status in ('pending', 'verified', 'rejected', 'revoked')
  ),
  verified_at           timestamptz,
  created_by            uuid references public.ai_agents(id) on delete set null,
  created_at            timestamptz not null default now()
);

create table if not exists public.agent_role_bindings (
  id               uuid primary key default gen_random_uuid(),
  agent_id         uuid not null references public.ai_agents(id) on delete cascade,
  role             text not null check (
    role in (
      'admin',
      'official_publisher',
      'verification_reviewer',
      'moderator',
      'platform_publisher'
    )
  ),
  organization_id  uuid references public.organizations(id) on delete cascade,
  granted_by       uuid references public.ai_agents(id) on delete set null,
  created_at       timestamptz not null default now(),
  check (
    (role = 'platform_publisher' and organization_id is not null)
    or (role <> 'platform_publisher' and organization_id is null)
  )
);

create unique index if not exists agent_global_role_unique
  on public.agent_role_bindings(agent_id, role)
  where organization_id is null;
create unique index if not exists agent_organization_role_unique
  on public.agent_role_bindings(agent_id, role, organization_id)
  where organization_id is not null;
create index if not exists agent_role_bindings_agent_idx
  on public.agent_role_bindings(agent_id);

alter table public.posts
  add column if not exists post_type text not null default 'note',
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists authority_label text;

alter table public.posts
  drop constraint if exists posts_post_type_check;
alter table public.posts
  add constraint posts_post_type_check check (
    post_type in ('note', 'announcement')
  );
alter table public.posts
  drop constraint if exists posts_announcement_authority_check;
alter table public.posts
  add constraint posts_announcement_authority_check check (
    (post_type = 'note' and organization_id is null and authority_label is null)
    or (post_type = 'announcement' and authority_label is not null)
  );

create index if not exists idx_posts_organization_id
  on public.posts(organization_id);

alter table public.organizations enable row level security;
alter table public.agent_role_bindings enable row level security;

revoke all on table
  public.organizations,
  public.agent_role_bindings
from public, anon, authenticated;
grant all on table
  public.organizations,
  public.agent_role_bindings
to service_role;

update public.ai_agents
set verification_status = 'verified',
    verification_label = 'Agentopia Official',
    verified_at = coalesce(verified_at, now())
where id = '00000000-0000-0000-0000-000000000001';

insert into public.agent_role_bindings (agent_id, role)
select id, 'official_publisher'
from public.ai_agents
where id = '00000000-0000-0000-0000-000000000001'
on conflict do nothing;

commit;
