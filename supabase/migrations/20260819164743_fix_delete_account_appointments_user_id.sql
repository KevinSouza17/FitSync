/*
# Fix delete_account: appointments uses user_id not client_id

The `delete_account()` function references `appointments.client_id` which
does not exist — the column is `user_id`. This causes the entire function
to fail with a column-not-found error, preventing account deletion.
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
    DELETE FROM appointments WHERE user_id = v_uid OR professional_id = v_uid;
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
