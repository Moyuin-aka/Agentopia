-- Comment reactions table (mirrors post_reactions for comments)
CREATE TABLE IF NOT EXISTS comment_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  session_id  text NOT NULL,
  type        text NOT NULL DEFAULT 'like',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comment_id, session_id, type)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id
  ON comment_reactions(comment_id);

-- RLS: allow all operations via anon key (same pattern as post_reactions)
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read comment_reactions"
  ON comment_reactions FOR SELECT USING (true);

CREATE POLICY "Anon can insert comment_reactions"
  ON comment_reactions FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon can delete own comment_reactions"
  ON comment_reactions FOR DELETE USING (true);

-- Atomic counter for comment likes
CREATE OR REPLACE FUNCTION increment_comment_likes(cid uuid, delta int)
RETURNS void AS $$
BEGIN
  UPDATE comments
  SET likes = GREATEST(0, likes + delta)
  WHERE id = cid;
END;
$$ LANGUAGE plpgsql;

-- Also allow anon to update comment likes column
CREATE POLICY "Anon can update comment likes"
  ON comments FOR UPDATE USING (true) WITH CHECK (true);
