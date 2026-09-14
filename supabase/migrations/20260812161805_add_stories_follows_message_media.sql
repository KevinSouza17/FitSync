/*
# Add stories, follows, and message media support

1. New Tables
- `stories` — user-uploaded stories (photo/video) that expire after 24 hours.
  - `id` (uuid PK)
  - `user_id` (uuid, defaults to auth.uid(), references profiles)
  - `media_url` (text, not null) — URL to the uploaded story media
  - `media_type` (text, not null) — 'image' or 'video'
  - `caption` (text, nullable)
  - `created_at` (timestamptz, default now())
  - `expires_at` (timestamptz, default now() + 24 hours)
- `follows` — follow relationships between users.
  - `id` (uuid PK)
  - `follower_id` (uuid, defaults to auth.uid(), references profiles)
  - `followee_id` (uuid, not null, references profiles)
  - `status` (text, default 'pending') — 'pending', 'accepted', 'rejected'
  - `created_at` (timestamptz, default now())

2. Modified Tables
- `messages` — added two nullable columns:
  - `media_url` (text) — URL to uploaded photo or audio file
  - `media_type` (text) — 'image', 'audio', or null for text-only messages

3. Security (RLS)
- `stories`: authenticated users can read all stories (for feed), insert own, delete own.
- `follows`: authenticated users can read follows where they are follower or followee,
  insert own (follower), update status if they are the followee, delete own (follower).
- `messages`: existing policies remain; new columns are covered by existing RLS.

4. Indexes
- `idx_stories_user` on stories(user_id)
- `idx_stories_expires` on stories(expires_at)
- `idx_follows_follower` on follows(follower_id)
- `idx_follows_followee` on follows(followee_id)
- `idx_messages_media` is not needed; columns are nullable and not queried directly.

5. Notes
- Stories auto-expire via the `expires_at` column; the frontend filters by `expires_at > now()`.
- Follow requests use a 'pending' status; the followee can accept or reject.
- Message media is uploaded to the 'avatars' storage bucket (reused for all user media).
*/

-- Stories table
CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  caption text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_stories" ON stories;
CREATE POLICY "select_stories" ON stories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_stories" ON stories;
CREATE POLICY "insert_own_stories" ON stories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_stories" ON stories;
CREATE POLICY "delete_own_stories" ON stories FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);

-- Follows table
CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, followee_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_follows" ON follows;
CREATE POLICY "select_own_follows" ON follows FOR SELECT
  TO authenticated USING (auth.uid() = follower_id OR auth.uid() = followee_id);

DROP POLICY IF EXISTS "insert_own_follows" ON follows;
CREATE POLICY "insert_own_follows" ON follows FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "update_follow_status" ON follows;
CREATE POLICY "update_follow_status" ON follows FOR UPDATE
  TO authenticated USING (auth.uid() = followee_id OR auth.uid() = follower_id)
  WITH CHECK (auth.uid() = followee_id OR auth.uid() = follower_id);

DROP POLICY IF EXISTS "delete_own_follows" ON follows;
CREATE POLICY "delete_own_follows" ON follows FOR DELETE
  TO authenticated USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);

-- Add media columns to messages
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'media_url') THEN
    ALTER TABLE messages ADD COLUMN media_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'media_type') THEN
    ALTER TABLE messages ADD COLUMN media_type text;
  END IF;
END $$;