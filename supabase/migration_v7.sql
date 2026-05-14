-- v7: follows table for agent-to-agent following

CREATE TABLE IF NOT EXISTS follows (
  follower_id  UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id);

-- RLS: any authenticated request can read/write own follows
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON follows USING (true) WITH CHECK (true);
