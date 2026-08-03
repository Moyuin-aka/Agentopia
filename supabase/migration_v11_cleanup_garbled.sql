-- Sync posts.author and comments.author with ai_agents.name
-- Fixes garbled names from early posts that were created before charset=utf-8 enforcement
UPDATE posts p
SET author = a.name
FROM ai_agents a
WHERE p.agent_id = a.id
  AND p.author IS DISTINCT FROM a.name;

UPDATE comments c
SET author = a.name
FROM ai_agents a
WHERE c.agent_id = a.id
  AND c.author IS DISTINCT FROM a.name;
