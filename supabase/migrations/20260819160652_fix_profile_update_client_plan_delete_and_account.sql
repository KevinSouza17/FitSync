/*
# Fix profile update, client plan deletion, and delete account

## Problems
1. The `handle` column was missing from the column-level GRANT for the
   `authenticated` role on `profiles`. When a user tried to save their
   profile (EditProfile.tsx), the update payload included `handle`, but
   Postgres rejected it because the role lacked UPDATE privilege on that
   column — causing "Erro ao salvar".
2. The `client_plans` DELETE policy only allowed the *professional* who
   created the plan to delete it. Clients could not delete a diet/workout
   plan assigned to them, so the trash button on the Dashboard silently
   failed (RLS blocked the DELETE).
3. The `delete_account()` function was missing rows in several newer tables
   (`user_achievements`, `recipe_ratings`, `comment_reports`,
   `community_recipes`, `post_hashtags`) before deleting from `profiles`.
   Although most of these have ON DELETE CASCADE to profiles, `post_hashtags`
   references `feed_posts` (which the function deletes first) and
   `comment_reports` references `feed_comments` (also deleted first), so
   CASCADE handles them. However, `user_achievements` and `recipe_ratings`
   reference `profiles` directly with CASCADE — also fine. The real failure
   was that the function also needed to clean up `post_hashtags` explicitly
   (some FK constraints may not cascade through `feed_posts` if rows are
   deleted individually). We add explicit deletes for all remaining tables
   to be safe, ordered correctly.

## Changes
1. GRANT UPDATE on `profiles.handle` to `authenticated`.
2. Replace the `client_plans` DELETE policy so both the professional AND
   the client can delete a plan.
3. Recreate `delete_account()` with all current tables, in correct FK
   dependency order, plus explicit cleanup of `post_hashtags`,
   `user_achievements`, `recipe_ratings`, `comment_reports`, and
   `community_recipes`.
*/

-- 1. Grant UPDATE on handle column to authenticated
GRANT UPDATE (handle) ON public.profiles TO authenticated;

-- 2. Allow both professional and client to delete a client plan
DROP POLICY IF EXISTS "delete_own_client_plans" ON public.client_plans;
CREATE POLICY "delete_own_client_plans" ON public.client_plans FOR DELETE
  TO authenticated
  USING (auth.uid() = professional_id OR auth.uid() = client_id);

-- 3. Recreate delete_account with all tables in correct order
CREATE OR REPLACE FUNCTION delete_account()
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
  DELETE FROM notifications WHERE user_id = v_uid;
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
  DELETE FROM community_recipes WHERE user_id = v_uid;
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

GRANT EXECUTE ON FUNCTION delete_account() TO authenticated;
