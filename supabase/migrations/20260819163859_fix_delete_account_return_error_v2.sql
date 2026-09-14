/*
# Fix delete_account to return error details

## Problem
The `delete_account()` function fails silently — the RPC call returns an
error but the user can't see what went wrong.

## Changes
1. DROP the existing `delete_account()` function (returns void).
2. Recreate it to return `text` — 'OK' on success, error message on failure.
3. Added `auth` to search_path so `auth.users` resolves correctly.
4. Wraps all deletes in a BEGIN/EXCEPTION block to capture the exact error.
*/

DROP FUNCTION IF EXISTS public.delete_account();

CREATE FUNCTION public.delete_account()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_err text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'Not authenticated';
  END IF;

  BEGIN
    DELETE FROM post_hashtags WHERE post_id IN (SELECT id FROM feed_posts WHERE user_id = v_uid);
    DELETE FROM comment_reports WHERE reporter_id = v_uid;
    DELETE FROM post_reports WHERE reporter_id = v_uid;
    DELETE FROM feed_likes WHERE user_id = v_uid;
    DELETE FROM feed_comments WHERE user_id = v_uid;
    DELETE FROM feed_posts WHERE user_id = v_uid;
    DELETE FROM stories WHERE user_id = v_uid;
    DELETE FROM follows WHERE follower_id = v_uid OR followee_id = v_uid;
    DELETE FROM notifications WHERE user_id = v_uid;
    UPDATE notifications SET inviter_id = NULL WHERE inviter_id = v_uid;
    DELETE FROM messages WHERE sender_id = v_uid;
    DELETE FROM conversations WHERE user_a_id = v_uid OR user_b_id = v_uid;
    DELETE FROM workout_logs WHERE user_id = v_uid;
    DELETE FROM workout_exercises WHERE program_day_id IN (
      SELECT id FROM workout_days WHERE program_id IN (
        SELECT id FROM workout_programs WHERE user_id = v_uid
      )
    );
    DELETE FROM workout_days WHERE program_id IN (SELECT id FROM workout_programs WHERE user_id = v_uid);
    DELETE FROM workout_programs WHERE user_id = v_uid;
    DELETE FROM exercises WHERE user_id = v_uid;
    DELETE FROM diary_tasks WHERE user_id = v_uid;
    DELETE FROM water_logs WHERE user_id = v_uid;
    DELETE FROM weight_logs WHERE user_id = v_uid;
    DELETE FROM meals WHERE user_id = v_uid;
    DELETE FROM goals WHERE user_id = v_uid;
    DELETE FROM custom_foods WHERE user_id = v_uid;
    DELETE FROM onboarding_answers WHERE user_id = v_uid;
    DELETE FROM diet_streaks WHERE user_id = v_uid;
    DELETE FROM recipe_ratings WHERE user_id = v_uid;
    DELETE FROM community_recipes WHERE user_id = v_uid AND is_official = false;
    DELETE FROM user_achievements WHERE user_id = v_uid;
    DELETE FROM site_reviews WHERE user_id = v_uid;
    DELETE FROM professional_verification WHERE user_id = v_uid;
    DELETE FROM client_plans WHERE client_id = v_uid OR professional_id = v_uid;
    DELETE FROM appointments WHERE client_id = v_uid OR professional_id = v_uid;
    DELETE FROM professional_plans WHERE professional_id = v_uid;
    DELETE FROM profiles WHERE id = v_uid;
    DELETE FROM auth.users WHERE id = v_uid;
    RETURN 'OK';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RETURN 'Erro: ' || v_err;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_account() TO authenticated;
