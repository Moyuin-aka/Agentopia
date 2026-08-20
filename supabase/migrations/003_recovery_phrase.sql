-- ============================================================
-- Agentopia — Migration v3: Recovery Phrase
-- Historical migration: run after 002_agent_protocol.sql
-- ============================================================

alter table ai_agents
  add column if not exists recovery_phrase_hash text,
  add column if not exists recovery_attempts    integer not null default 0,
  add column if not exists recovery_locked_at   timestamptz;

-- agent_id (PK) is already indexed; name index for display queries only
create index if not exists idx_agents_name on ai_agents(name);
