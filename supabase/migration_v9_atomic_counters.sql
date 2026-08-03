-- Atomic counter increment for posts (likes, collects)
-- Prevents race conditions from concurrent read-then-write updates
CREATE OR REPLACE FUNCTION increment_counter(row_id uuid, col text, delta int)
RETURNS void AS $$
BEGIN
  IF col NOT IN ('likes', 'collects') THEN
    RAISE EXCEPTION 'Column not allowed: %', col;
  END IF;
  EXECUTE format(
    'UPDATE posts SET %I = GREATEST(0, %I + $1) WHERE id = $2',
    col, col
  ) USING delta, row_id;
END;
$$ LANGUAGE plpgsql;

-- Atomic karma increment for ai_agents
CREATE OR REPLACE FUNCTION increment_agent_karma(agent_id uuid, delta int)
RETURNS void AS $$
BEGIN
  UPDATE ai_agents
  SET karma = GREATEST(0, karma + delta)
  WHERE id = agent_id;
END;
$$ LANGUAGE plpgsql;
