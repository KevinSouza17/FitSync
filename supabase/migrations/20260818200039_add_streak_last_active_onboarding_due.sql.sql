/*
# Streak tracking, last-active timestamp, and onboarding re-check window

## Context
1. The onboarding questionnaire currently re-appears every login because
   `onboarding_completed` is a boolean that never resets. We want it to
   re-appear ONLY after 7 days of inactivity.
2. We need a streak mechanic for logging diet (meals). A user who logs at
   least one meal on consecutive days builds a streak; missing a day resets it.
3. We need a `last_active_at` timestamp updated on each app open so we can
   compute the 7-day inactivity window.

## Changes
### profiles (ALTER, no data loss)
- `last_active_at` timestamptz — updated on each app session.
- `onboarding_due_at` timestamptz — when set and in the past, the onboarding
  questionnaire should re-appear. NULL means not due.

### diet_streaks (NEW table)
- `id` uuid PK
- `user_id` uuid FK -> auth.users ON DELETE CASCADE, UNIQUE
- `current_streak` int (days, default 0)
- `longest_streak` int (default 0)
- `last_log_date` date — the date of the last meal log that counted toward the streak
- `created_at`, `updated_at` timestamptz

### Function: upsert_diet_streak(p_user uuid, p_log_date date)
SECURITY DEFINER — callable by authenticated users. Updates the streak:
- If `p_log_date` == `last_log_date` → no change (already counted today).
- If `p_log_date` == `last_log_date + 1` → increment streak.
- Otherwise → reset streak to 1.
Also updates `longest_streak` and `last_log_date`.
Returns the new `current_streak`.

### Function: check_onboarding_due(p_user uuid) -> boolean
SECURITY DEFINER. Returns true if:
- `onboarding_completed` is false, OR
- `onboarding_due_at` is not null and `onboarding_due_at <= now()`.

### Function: touch_last_active(p_user uuid)
SECURITY DEFINER. Updates `last_active_at` to now() and, if the user has been
inactive for >= 7 days, sets `onboarding_due_at = now()` so the questionnaire
re-appears (the client will reset `onboarding_completed` to false when it
navigates to the questionnaire).

## Security
- RLS enabled on `diet_streaks`; owner-scoped CRUD policies.
- Functions are SECURITY DEFINER with `search_path = public` and only callable
  by authenticated users.
*/

-- 1) profiles columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_due_at timestamptz;

-- 2) diet_streaks table
CREATE TABLE IF NOT EXISTS diet_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  last_log_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diet_streaks_user_unique UNIQUE (user_id)
);
ALTER TABLE diet_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_diet_streak" ON diet_streaks;
CREATE POLICY "select_own_diet_streak" ON diet_streaks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_diet_streak" ON diet_streaks;
CREATE POLICY "insert_own_diet_streak" ON diet_streaks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_diet_streak" ON diet_streaks;
CREATE POLICY "update_own_diet_streak" ON diet_streaks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_diet_streak" ON diet_streaks;
CREATE POLICY "delete_own_diet_streak" ON diet_streaks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 3) upsert_diet_streak function
CREATE OR REPLACE FUNCTION upsert_diet_streak(p_user uuid, p_log_date date)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row diet_streaks%ROWTYPE;
  v_new_streak int;
  v_longest int;
BEGIN
  SELECT * INTO v_row FROM diet_streaks WHERE user_id = p_user FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO diet_streaks (user_id, current_streak, longest_streak, last_log_date)
    VALUES (p_user, 1, 1, p_log_date)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING current_streak INTO v_new_streak;
    IF v_new_streak IS NULL THEN
      SELECT current_streak INTO v_new_streak FROM diet_streaks WHERE user_id = p_user;
    END IF;
    RETURN COALESCE(v_new_streak, 1);
  END IF;

  IF v_row.last_log_date IS NULL THEN
    v_new_streak := 1;
  ELSIF p_log_date = v_row.last_log_date THEN
    v_new_streak := v_row.current_streak;
  ELSIF p_log_date = v_row.last_log_date + 1 THEN
    v_new_streak := v_row.current_streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  v_longest := GREATEST(v_row.longest_streak, v_new_streak);

  UPDATE diet_streaks
  SET current_streak = v_new_streak,
      longest_streak = v_longest,
      last_log_date = p_log_date,
      updated_at = now()
  WHERE user_id = p_user;

  RETURN v_new_streak;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_diet_streak(uuid, date) TO authenticated;

-- 4) check_onboarding_due function
CREATE OR REPLACE FUNCTION check_onboarding_due(p_user uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(onboarding_completed, false) = false
    OR (onboarding_due_at IS NOT NULL AND onboarding_due_at <= now())
  FROM profiles
  WHERE id = p_user;
$$;

GRANT EXECUTE ON FUNCTION check_onboarding_due(uuid) TO authenticated;

-- 5) touch_last_active function
CREATE OR REPLACE FUNCTION touch_last_active(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_active timestamptz;
  v_due_at timestamptz;
BEGIN
  SELECT last_active_at, onboarding_due_at INTO v_last_active, v_due_at
  FROM profiles WHERE id = p_user;

  IF v_last_active IS NULL THEN
    UPDATE profiles SET last_active_at = now() WHERE id = p_user;
    RETURN;
  END IF;

  -- If inactive >= 7 days, schedule onboarding re-check
  IF now() - v_last_active >= interval '7 days' AND v_due_at IS NULL THEN
    UPDATE profiles
    SET last_active_at = now(),
        onboarding_due_at = now(),
        onboarding_completed = false
    WHERE id = p_user;
  ELSE
    UPDATE profiles SET last_active_at = now() WHERE id = p_user;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION touch_last_active(uuid) TO authenticated;

-- 6) Allow users to update their own last_active_at / onboarding_due_at
-- (already covered by existing profiles update policy, but ensure onboarding_due_at
--  can be cleared by the client after completing the questionnaire)
