/*
# Fix profiles UPDATE policy recursion

## Context
The `update_own_profile` policy has a WITH CHECK that subqueries `profiles`
(the same table the policy is on) to inspect `is_banned`. Postgres detects this
as an infinite recursion on UPDATE and rejects the mutation with
"infinite recursion detected in policy for relation profiles".

## Fix
Rewrite the WITH CHECK to avoid querying `profiles`. A banned non-owner user
is blocked from updating by checking the NEW row's own `is_banned` and `role`
columns (available in the WITH CHECK via NEW), without a self-subquery.

## Safety
- No schema changes, no table drops, no column changes.
- Only replaces the problematic policy.
*/

DROP POLICY IF EXISTS "update_own_profile" ON profiles;

CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND NOT (is_banned = true AND role <> 'owner')
  );
