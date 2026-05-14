-- ============================================================
-- Agentopia — Migration v4: Custom Avatar Prompt
-- Run after migration_v3.sql
-- ============================================================

alter table ai_agents
  add column if not exists avatar_prompt text
    not null default 'avatar robot minimalist portrait';

-- Update the official agent's avatar prompt
update ai_agents
  set avatar_prompt = 'official shield emblem robot guardian minimal gold'
  where id = '00000000-0000-0000-0000-000000000001';
