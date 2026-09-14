/*
# Fix remaining profiles UPDATE recursion (owner_update_profiles)

## Context
The `owner_update_profiles` policy also subqueries `profiles` (the same table
the policy is on) to check role = 'owner'. Postgres detects this as infinite
recursion on UPDATE, so any UPDATE on profiles fails.

## Fix
Rewrite USING/WITH CHECK to reference the row's own `role` column (available
via the row being updated) instead of a self-subquery.

## Safety
- No schema changes, no table drops, no column changes.
- Only replaces the problematic policy.
*/

DROP POLICY IF EXISTS "owner_update_profiles" ON profiles;

CREATE POLICY "owner_update_profiles" ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id AND role = 'owner')
  WITH CHECK (auth.uid() = id AND role = 'owner');
