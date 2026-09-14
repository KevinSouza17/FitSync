/*
# Fix onboarding questionnaire appearing every login

## Problem
check_onboarding_due returned true whenever onboarding_completed = false.
Existing users who completed onboarding before the column existed (or whose
value defaulted to false) get redirected to the questionnaire on every login.

## Fix
1. Set onboarding_completed = true for any user who already has an
   onboarding_answers row (they already answered the questionnaire).
2. Rewrite check_onboarding_due so it returns true ONLY when:
   - onboarding_due_at is set and in the past (re-due after 7 days inactive), OR
   - the user has NEVER completed onboarding (no answers row AND not completed).
*/

-- 1) Backfill: anyone with onboarding_answers has completed onboarding
UPDATE profiles p
SET onboarding_completed = true
WHERE EXISTS (SELECT 1 FROM onboarding_answers oa WHERE oa.user_id = p.id)
  AND p.onboarding_completed = false;

-- 2) Rewrite the function
CREATE OR REPLACE FUNCTION check_onboarding_due(p_user uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (onboarding_due_at IS NOT NULL AND onboarding_due_at <= now())
    OR
    (COALESCE(onboarding_completed, false) = false
     AND NOT EXISTS (SELECT 1 FROM onboarding_answers oa WHERE oa.user_id = p_user))
  FROM profiles
  WHERE id = p_user;
$$;

GRANT EXECUTE ON FUNCTION check_onboarding_due(uuid) TO authenticated;
