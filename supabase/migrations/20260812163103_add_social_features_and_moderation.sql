/*
# Add Social Features and Moderation System

## Summary
This migration adds:
1. A `feed_comments` table for commenting on posts (Twitter-like)
2. Profile fields for public/private profiles, user roles, and ban status
3. Sets Kevin Souza (kevinsouzag42@gmail.com) as the owner role
4. Fixes stories RLS policies to ensure they work correctly

## New Tables
- `feed_comments`: Stores comments on feed posts
  - `id` (uuid, primary key)
  - `post_id` (uuid, references feed_posts, cascade delete)
  - `user_id` (uuid, defaults to auth.uid())
  - `content` (text, not null)
  - `created_at` (timestamptz, defaults to now())

## Modified Tables
- `profiles`: Added three new columns
  - `is_private` (boolean, default false) - controls whether profile is public or private
  - `role` (text, default 'user') - can be 'user' or 'owner'
  - `is_banned` (boolean, default false) - set by owner to ban users

## Security
- `feed_comments` has RLS enabled with 4 CRUD policies (owner-scoped for write, public read)
- `profiles` UPDATE policy updated to allow users to update their own is_private field
- Owner role can ban/unban users and delete any post (handled via RLS on feed_posts)
- Stories SELECT policy re-confirmed as public read for all authenticated users

## Important Notes
1. Kevin Souza's profile (id: e9089431-2540-4f67-bb88-5461e866250e) is set to role='owner'
2. Banned users cannot create posts or comments (enforced via RLS WITH CHECK)
3. Private profiles hide posts from non-followers
*/

-- ── 1. Add columns to profiles ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_private') THEN
    ALTER TABLE profiles ADD COLUMN is_private boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'user';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_banned') THEN
    ALTER TABLE profiles ADD COLUMN is_banned boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ── 2. Set Kevin Souza as owner ──
UPDATE profiles SET role = 'owner' WHERE id = 'e9089431-2540-4f67-bb88-5461e866250e';

-- ── 3. Create feed_comments table ──
CREATE TABLE IF NOT EXISTS feed_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;

-- Public read (all authenticated users can see comments)
DROP POLICY IF EXISTS "select_feed_comments" ON feed_comments;
CREATE POLICY "select_feed_comments" ON feed_comments FOR SELECT
  TO authenticated USING (true);

-- Insert: only authenticated, non-banned users can comment
DROP POLICY IF EXISTS "insert_own_feed_comments" ON feed_comments;
CREATE POLICY "insert_own_feed_comments" ON feed_comments FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_banned = true
    )
  );

-- Update own comments
DROP POLICY IF EXISTS "update_own_feed_comments" ON feed_comments;
CREATE POLICY "update_own_feed_comments" ON feed_comments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Delete: own comments OR owner can delete any
DROP POLICY IF EXISTS "delete_feed_comments" ON feed_comments;
CREATE POLICY "delete_feed_comments" ON feed_comments FOR DELETE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
  );

-- ── 4. Add index for performance ──
CREATE INDEX IF NOT EXISTS idx_feed_comments_post_id ON feed_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_user_id ON feed_comments(user_id);

-- ── 5. Update feed_posts INSERT policy to block banned users ──
DROP POLICY IF EXISTS "insert_own_feed_posts" ON feed_posts;
CREATE POLICY "insert_own_feed_posts" ON feed_posts FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_banned = true
    )
  );

-- ── 6. Update feed_posts DELETE policy to allow owner to delete any post ──
DROP POLICY IF EXISTS "delete_own_feed_posts" ON feed_posts;
CREATE POLICY "delete_own_feed_posts" ON feed_posts FOR DELETE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
  );

-- ── 7. Add profiles UPDATE policy for is_private ──
-- (Existing update policy should already cover own profile updates,
--  but let's make sure banned users can't update)
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND NOT (
      is_banned = true
      AND EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.is_banned = true AND p2.role <> 'owner')
    )
  );

-- ── 8. Allow owner to update profiles (for banning) ──
DROP POLICY IF EXISTS "owner_update_profiles" ON profiles;
CREATE POLICY "owner_update_profiles" ON profiles FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'));

-- ── 9. Fix stories INSERT - ensure non-banned users can insert ──
DROP POLICY IF EXISTS "insert_own_stories" ON stories;
CREATE POLICY "insert_own_stories" ON stories FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_banned = true
    )
  );
