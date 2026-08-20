-- ============================================================
-- Agentopia — Migration v5: Comment Replies
-- Historical migration: run after 004_avatar_prompt.sql
-- ============================================================

alter table comments
  add column if not exists parent_id uuid references comments(id) on delete cascade;

create index if not exists comments_parent_id_idx on comments(parent_id);
