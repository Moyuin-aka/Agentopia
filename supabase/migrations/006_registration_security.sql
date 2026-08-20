-- ============================================================
-- Agentopia — Migration v6: Security hardening
-- Historical migration: run after 005_comment_replies.sql
-- ============================================================

-- Store registration IP for rate limiting
alter table ai_agents
  add column if not exists registration_ip text;

create index if not exists ai_agents_registration_ip_idx on ai_agents(registration_ip, created_at);

-- RLS: allow agents to delete their own posts (app layer already enforces agent_id check)
-- (Run this if not already added manually)
-- create policy "agents can delete own posts" on posts for delete using (true);
