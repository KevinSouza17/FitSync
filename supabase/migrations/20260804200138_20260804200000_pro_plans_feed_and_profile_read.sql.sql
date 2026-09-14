/*
# Professional Plans, Social Feed, and Public Profile Read Access

## What this migration does

1. Creates `professional_plans` table so professionals can create/edit/delete
   their own service plans (name, price, tagline, features, popular flag) instead
   of having them hardcoded in the frontend.
2. Creates `feed_posts` table for a social feed where any authenticated user can
   post text updates with an optional image.
3. Creates `feed_likes` table for likes on feed posts.
4. Adds a SELECT policy on `profiles` so any authenticated user can view other
   users' professional profiles (public directory).

## New Tables

### professional_plans
- id (uuid PK)
- professional_id (uuid, references profiles.id, ON DELETE CASCADE)
- name (text, not null)
- price (integer, not null)
- tagline (text)
- features (jsonb — array of { label, included })
- popular (boolean, default false)
- sort_order (integer, default 0)
- created_at (timestamptz)

### feed_posts
- id (uuid PK)
- user_id (uuid, DEFAULT auth.uid(), references profiles.id, ON DELETE CASCADE)
- content (text, not null)
- image_url (text)
- created_at (timestamptz)

### feed_likes
- id (uuid PK)
- post_id (uuid, references feed_posts.id, ON DELETE CASCADE)
- user_id (uuid, DEFAULT auth.uid(), references profiles.id, ON DELETE CASCADE)
- created_at (timestamptz)
- UNIQUE(post_id, user_id)

## Security

### professional_plans
- RLS enabled.
- Anyone authenticated can SELECT (to view a pro's plans on their profile).
- Only the owner (professional_id = auth.uid()) can INSERT/UPDATE/DELETE.

### feed_posts
- RLS enabled.
- Anyone authenticated can SELECT (feed is social, visible to all).
- Only owner can INSERT/UPDATE/DELETE own posts.

### feed_likes
- RLS enabled.
- Anyone authenticated can SELECT (to show like counts).
- Only owner can INSERT/DELETE own likes.

### profiles (existing table)
- Adds a SELECT policy allowing any authenticated user to read any profile row
  so professional profiles can be browsed publicly. Existing owner-scoped
  UPDATE policy is not affected.
*/

-- ── professional_plans ──
CREATE TABLE IF NOT EXISTS professional_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  tagline text NOT NULL DEFAULT '',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  popular boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE professional_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_pro_plans" ON professional_plans;
CREATE POLICY "select_pro_plans" ON professional_plans FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_pro_plans" ON professional_plans;
CREATE POLICY "insert_own_pro_plans" ON professional_plans FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = professional_id);

DROP POLICY IF EXISTS "update_own_pro_plans" ON professional_plans;
CREATE POLICY "update_own_pro_plans" ON professional_plans FOR UPDATE
  TO authenticated USING (auth.uid() = professional_id) WITH CHECK (auth.uid() = professional_id);

DROP POLICY IF EXISTS "delete_own_pro_plans" ON professional_plans;
CREATE POLICY "delete_own_pro_plans" ON professional_plans FOR DELETE
  TO authenticated USING (auth.uid() = professional_id);

-- ── feed_posts ──
CREATE TABLE IF NOT EXISTS feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_feed_posts" ON feed_posts;
CREATE POLICY "select_feed_posts" ON feed_posts FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_feed_posts" ON feed_posts;
CREATE POLICY "insert_own_feed_posts" ON feed_posts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_feed_posts" ON feed_posts;
CREATE POLICY "update_own_feed_posts" ON feed_posts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_feed_posts" ON feed_posts;
CREATE POLICY "delete_own_feed_posts" ON feed_posts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── feed_likes ──
CREATE TABLE IF NOT EXISTS feed_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE feed_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_feed_likes" ON feed_likes;
CREATE POLICY "select_feed_likes" ON feed_likes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_feed_likes" ON feed_likes;
CREATE POLICY "insert_own_feed_likes" ON feed_likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_feed_likes" ON feed_likes;
CREATE POLICY "delete_own_feed_likes" ON feed_likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── profiles: allow any authenticated user to read any profile ──
DROP POLICY IF EXISTS "select_any_profile" ON profiles;
CREATE POLICY "select_any_profile" ON profiles FOR SELECT
  TO authenticated USING (true);