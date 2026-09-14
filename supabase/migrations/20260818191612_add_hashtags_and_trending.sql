/*
# Hashtags and Trending Topics

## Context
The community feed needs community-driven hashtags. When a user writes a post,
hashtags (#example) are parsed from the content and stored. A trending topics
view ranks hashtags by usage in the last 7 days so the feed can show a
"Trending" sidebar.

## New Tables
- `hashtags`: catalog of unique hashtag names (lowercase, no #).
- `post_hashtags`: join table linking feed_posts to hashtags (many-to-many).

## New Views
- `trending_hashtags`: ranks hashtags by post count in the last 7 days.

## Security
- RLS enabled on both new tables.
- `hashtags`: anyone authenticated can read; anyone authenticated can insert
  (a new hashtag is created the first time it's used — community-driven).
- `post_hashtags`: anyone authenticated can read; only the post owner can
  insert/delete rows for their own post (ownership checked via feed_posts).
- No update policies needed — rows are created and deleted, never edited.
*/

-- 1) Hashtags catalog
CREATE TABLE IF NOT EXISTS hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_hashtags" ON hashtags;
CREATE POLICY "read_hashtags" ON hashtags FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_hashtags" ON hashtags;
CREATE POLICY "insert_hashtags" ON hashtags FOR INSERT
  TO authenticated WITH CHECK (true);

-- 2) Post-hashtag join
CREATE TABLE IF NOT EXISTS post_hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  hashtag_id uuid NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_hashtag_unique UNIQUE (post_id, hashtag_id)
);

ALTER TABLE post_hashtags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_post_hashtags" ON post_hashtags;
CREATE POLICY "read_post_hashtags" ON post_hashtags FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_post_hashtags" ON post_hashtags;
CREATE POLICY "insert_post_hashtags" ON post_hashtags FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM feed_posts fp
      WHERE fp.id = post_hashtags.post_id AND fp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_post_hashtags" ON post_hashtags;
CREATE POLICY "delete_post_hashtags" ON post_hashtags FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM feed_posts fp
      WHERE fp.id = post_hashtags.post_id AND fp.user_id = auth.uid()
    )
  );

-- Index for trending query performance
CREATE INDEX IF NOT EXISTS idx_post_hashtags_hashtag_id ON post_hashtags(hashtag_id);
CREATE INDEX IF NOT EXISTS idx_post_hashtags_created_at ON post_hashtags(created_at DESC);

-- 3) Trending hashtags view (last 7 days, top 20)
CREATE OR REPLACE VIEW trending_hashtags AS
SELECT
  h.id,
  h.tag,
  COUNT(ph.id)::int AS post_count
FROM hashtags h
JOIN post_hashtags ph ON ph.hashtag_id = h.id
WHERE ph.created_at >= now() - interval '7 days'
GROUP BY h.id, h.tag
ORDER BY post_count DESC, h.tag ASC
LIMIT 20;
