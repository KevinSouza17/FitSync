/*
# Add unique constraint on handle + delete account function

## Changes
1. Deduplicate existing handles by appending a numeric suffix to the newer row.
2. Add UNIQUE partial index on lower(handle) where handle IS NOT NULL.
3. Create SECURITY DEFINER function delete_account() that deletes the current user's
   profile data, auth user, and related rows. Lets a user permanently delete their
   own account from Settings.
4. Grant execute to authenticated only.
*/

-- 1. Deduplicate: append -2, -3, ... to newer duplicates
WITH dups AS (
  SELECT id, handle, created_at,
    ROW_NUMBER() OVER (PARTITION BY lower(handle) ORDER BY created_at) AS rn
  FROM profiles
  WHERE handle IS NOT NULL
)
UPDATE profiles p
SET handle = d.handle || '-' || d.rn
FROM dups d
WHERE p.id = d.id AND d.rn > 1;

-- 2. Unique handle (partial index: only enforce uniqueness when handle is NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_unique_idx
  ON profiles (lower(handle))
  WHERE handle IS NOT NULL;

-- 3. Delete account function
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

  DELETE FROM feed_likes WHERE user_id = v_uid;
  DELETE FROM feed_comments WHERE user_id = v_uid;
  DELETE FROM feed_posts WHERE user_id = v_uid;
  DELETE FROM stories WHERE user_id = v_uid;
  DELETE FROM post_reports WHERE reporter_id = v_uid;
  DELETE FROM comment_reports WHERE reporter_id = v_uid;
  DELETE FROM follows WHERE follower_id = v_uid OR followee_id = v_uid;
  DELETE FROM notifications WHERE user_id = v_uid;
  DELETE FROM messages WHERE sender_id = v_uid;
  DELETE FROM conversations WHERE user_a_id = v_uid OR user_b_id = v_uid;
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
  DELETE FROM diary_tasks WHERE user_id = v_uid;
  DELETE FROM water_logs WHERE user_id = v_uid;
  DELETE FROM weight_logs WHERE user_id = v_uid;
  DELETE FROM meals WHERE user_id = v_uid;
  DELETE FROM goals WHERE user_id = v_uid;
  DELETE FROM custom_foods WHERE user_id = v_uid;
  DELETE FROM onboarding_answers WHERE user_id = v_uid;
  DELETE FROM diet_streaks WHERE user_id = v_uid;
  DELETE FROM site_reviews WHERE user_id = v_uid;
  DELETE FROM professional_verification WHERE user_id = v_uid;
  DELETE FROM client_plans WHERE client_id = v_uid OR professional_id = v_uid;
  DELETE FROM appointments WHERE client_id = v_uid OR professional_id = v_uid;
  DELETE FROM professional_plans WHERE professional_id = v_uid;
  DELETE FROM profiles WHERE id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_account() TO authenticated;
