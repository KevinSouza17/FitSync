/*
# Fix foreign keys: stories and feed_comments user_id -> profiles

## Summary
Both `stories.user_id` and `feed_comments.user_id` had FKs pointing to
`auth.users(id)` instead of `profiles(id)`. This meant the Supabase
PostgREST join syntax `profiles:user_id(full_name, avatar_url)` could not
resolve — PostgREST looks for a FK from the table column to the target
table, and found none pointing to `profiles`. As a result, stories and
comments appeared to not work: the profile join returned null, so no
avatar or name was shown, and in some cases the entire query failed.

## Changes
1. Drop `stories_user_id_fkey` (pointed to auth.users)
2. Drop `feed_comments_user_id_fkey` (pointed to auth.users)
3. Recreate both FKs pointing to `profiles(id)` ON DELETE CASCADE
*/

-- ── 1. Fix stories FK ──
ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_user_id_fkey;
ALTER TABLE stories
  ADD CONSTRAINT stories_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ── 2. Fix feed_comments FK ──
ALTER TABLE feed_comments DROP CONSTRAINT IF EXISTS feed_comments_user_id_fkey;
ALTER TABLE feed_comments
  ADD CONSTRAINT feed_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
