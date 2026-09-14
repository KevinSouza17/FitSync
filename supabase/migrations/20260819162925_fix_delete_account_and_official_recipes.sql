/*
# Fix delete_account function and add official recipe flag

## Problems
1. The `delete_account()` function fails because it doesn't clean up
   `notifications.inviter_id` for OTHER users' notifications before
   deleting from `auth.users`. The `notifications_inviter_id_fkey` has
   `ON DELETE SET NULL`, which should work, but some Supabase versions
   have issues with cross-schema FK resolution in SECURITY DEFINER
   functions. We add an explicit `UPDATE notifications SET inviter_id = NULL
   WHERE inviter_id = v_uid` before the auth.users delete to be safe.

2. Community recipes seeded by the system (FitSync) show the names of
   test accounts as the author. We add an `is_official` boolean column
   to `community_recipes` so the frontend can display "Adicionada por
   FitSync" instead of the seed account name.

## Changes
1. Add `is_official` boolean column to `community_recipes` (default false).
2. Mark all existing seeded recipes (user_id in the 3 known seed IDs)
   as `is_official = true`.
3. Recreate `delete_account()` with the extra `notifications.inviter_id`
   cleanup step and better error handling.
4. Add a view/RLS update so `is_official` is readable by all authenticated
   users.
*/

-- 1. Add is_official column
ALTER TABLE public.community_recipes
  ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;

-- 2. Mark seeded recipes as official
UPDATE public.community_recipes
SET is_official = true
WHERE user_id IN (
  'ab1a8120-1847-4a55-a129-f22f75a60545'::uuid,
  '939921e1-14f9-440c-8fb5-c57654035643'::uuid,
  'a4dd56a0-1cc3-4415-9cde-432d40041791'::uuid
);

-- 3. Recreate delete_account with extra cleanup
CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Child tables that reference feed_posts / feed_comments first
  DELETE FROM post_hashtags WHERE post_id IN (
    SELECT id FROM feed_posts WHERE user_id = v_uid
  );
  DELETE FROM comment_reports WHERE reporter_id = v_uid;
  DELETE FROM post_reports WHERE reporter_id = v_uid;
  DELETE FROM feed_likes WHERE user_id = v_uid;
  DELETE FROM feed_comments WHERE user_id = v_uid;
  DELETE FROM feed_posts WHERE user_id = v_uid;
  DELETE FROM stories WHERE user_id = v_uid;
  DELETE FROM follows WHERE follower_id = v_uid OR followee_id = v_uid;

  -- Notifications: delete user's own + null out inviter_id for others
  DELETE FROM notifications WHERE user_id = v_uid;
  UPDATE notifications SET inviter_id = NULL WHERE inviter_id = v_uid;

  DELETE FROM messages WHERE sender_id = v_uid;
  DELETE FROM conversations WHERE user_a_id = v_uid OR user_b_id = v_uid;

  -- Workout data
  DELETE FROM workout_logs WHERE user_id = v_uid;
  DELETE FROM workout_exercises WHERE program_day_id IN (
    SELECT id FROM workout_days WHERE program_id IN (
      SELECT id FROM workout_programs WHERE user_id = v_uid
    )
  );
  DELETE FROM workout_days WHERE program_id IN (
    SELECT id FROM workout_programs WHERE user_id = v_uid
  );
  DELETE FROM workout_programs WHERE user_id = v_uid;
  DELETE FROM exercises WHERE user_id = v_uid;

  -- Health tracking
  DELETE FROM diary_tasks WHERE user_id = v_uid;
  DELETE FROM water_logs WHERE user_id = v_uid;
  DELETE FROM weight_logs WHERE user_id = v_uid;
  DELETE FROM meals WHERE user_id = v_uid;
  DELETE FROM goals WHERE user_id = v_uid;
  DELETE FROM custom_foods WHERE user_id = v_uid;
  DELETE FROM onboarding_answers WHERE user_id = v_uid;
  DELETE FROM diet_streaks WHERE user_id = v_uid;

  -- Social / community
  DELETE FROM recipe_ratings WHERE user_id = v_uid;
  DELETE FROM community_recipes WHERE user_id = v_uid AND is_official = false;
  DELETE FROM user_achievements WHERE user_id = v_uid;

  -- Professional / client data
  DELETE FROM site_reviews WHERE user_id = v_uid;
  DELETE FROM professional_verification WHERE user_id = v_uid;
  DELETE FROM client_plans WHERE client_id = v_uid OR professional_id = v_uid;
  DELETE FROM appointments WHERE client_id = v_uid OR professional_id = v_uid;
  DELETE FROM professional_plans WHERE professional_id = v_uid;

  -- Finally the profile and auth user
  DELETE FROM profiles WHERE id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_account() TO authenticated;

-- 4. Grant SELECT on is_official to authenticated
GRANT SELECT (is_official) ON public.community_recipes TO authenticated;
