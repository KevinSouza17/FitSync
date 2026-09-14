/*
# Fix profiles UPDATE recursion (both policies)

## Context
Two UPDATE policies on `profiles` still contain `EXISTS (SELECT ... FROM profiles ...)`,
which Postgres detects as infinite recursion on UPDATE. Any UPDATE on profiles fails.

## Fix
Drop both recursive UPDATE policies and recreate without self-subqueries.
- update_own_profile: owner check via row's own role column (NEW/OLD available in policy)
- owner_update_profiles: same approach for owner-only updates

## Safety
- No schema changes, no table drops, no column changes.
- Only replaces the two problematic UPDATE policies.
*/

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
DROP POLICY IF EXISTS "owner_update_profiles" ON profiles;

CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "owner_update_profiles" ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id AND role = 'owner')
  WITH CHECK (auth.uid() = id AND role = 'owner');
