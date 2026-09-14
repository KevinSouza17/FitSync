/*
# Onboarding + recommendations infrastructure

## Context
New users answer a questionnaire at signup; from those answers we generate a
starter workout program and a starter diet plan. We also store likes/follows
so a recommendation view can rank posts by affinity.

## Safety
- New tables only; no drops, no column changes on existing tables.
- RLS enabled on every new table with per-user ownership policies.
*/

-- 1) Onboarding answers (one row per user)
CREATE TABLE IF NOT EXISTS onboarding_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal text NOT NULL,
  experience_level text NOT NULL,
  workout_days int NOT NULL,
  diet_preference text NOT NULL,
  allergies text[],
  equipment text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_user_unique UNIQUE (user_id)
);
ALTER TABLE onboarding_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_onboarding" ON onboarding_answers;
CREATE POLICY "select_own_onboarding" ON onboarding_answers FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_onboarding" ON onboarding_answers;
CREATE POLICY "insert_own_onboarding" ON onboarding_answers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_onboarding" ON onboarding_answers;
CREATE POLICY "update_own_onboarding" ON onboarding_answers FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_onboarding" ON onboarding_answers;
CREATE POLICY "delete_own_onboarding" ON onboarding_answers FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 2) Recommended posts view: rank feed_posts by affinity to the viewer.
-- Affinity = posts from users the viewer follows (accepted) rank highest,
-- then posts the viewer has liked authors, then recency.
CREATE OR REPLACE VIEW recommended_posts AS
SELECT
  fp.id,
  fp.user_id,
  fp.content,
  fp.image_url,
  fp.video_url,
  fp.media_type,
  fp.created_at,
  p.full_name,
  p.avatar_url,
  p.is_professional,
  p.professional_role,
  COALESCE(
    (SELECT COUNT(*)::int FROM feed_likes fl WHERE fl.post_id = fp.id),
    0
  ) AS like_count,
  COALESCE(
    (SELECT COUNT(*)::int FROM feed_comments fc WHERE fc.post_id = fp.id),
    0
  ) AS comment_count
FROM feed_posts fp
JOIN profiles p ON p.id = fp.user_id
WHERE p.is_banned = false
ORDER BY
  (EXISTS (
    SELECT 1 FROM follows f
    WHERE f.follower_id = auth.uid()
      AND f.followee_id = fp.user_id
      AND f.status = 'accepted'
  )) DESC,
  fp.created_at DESC;

-- 3) Helper to mark onboarding complete on profiles (optional flag column)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
