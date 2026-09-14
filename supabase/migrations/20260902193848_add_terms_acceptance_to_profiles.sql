/*
# Add terms acceptance tracking to profiles

1. Modified Tables
- `profiles`: Added `terms_accepted_at` (timestamptz, nullable) column.
  When NULL, the user has not accepted the Terms of Use and Privacy Policy.
  When set to a timestamp, the user accepted the terms at that moment.

2. Security
- No new RLS policies needed. The existing profiles UPDATE policy already
  allows authenticated users to update their own row, and the terms acceptance
  is written via an RPC function (SECURITY DEFINER) to prevent tampering.

3. New Functions
- `accept_terms(p_user uuid)`: SECURITY DEFINER function that sets
  `terms_accepted_at = now()` for the given user. Only callable by the user
  themselves (checked via auth.uid()).
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

CREATE OR REPLACE FUNCTION accept_terms(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = p_user THEN
    UPDATE profiles SET terms_accepted_at = now(), updated_at = now()
    WHERE id = p_user;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_terms(uuid) TO authenticated;
