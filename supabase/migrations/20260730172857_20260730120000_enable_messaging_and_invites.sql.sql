/*
# Enable messaging between users + email-invite conversations

## Summary
The Messages tab was broken: the conversation list showed "Usuário" for every
contact because the `profiles` SELECT policy was owner-only (`auth.uid() = id`),
so a user could never read another user's profile (name, role). The Team page
had the same root cause — it could only ever list the current user as a
professional.

This migration opens up read access on `profiles` to all authenticated users so
that conversation partners and discoverable professionals can be displayed.
Editing/deleting stays owner-only. This is an intentionally shared dataset in a
social health/messaging app, so a broad SELECT policy is appropriate and
documented here.

## Changes
1. profiles SELECT policy replaced:
   - Drops `select_own_profile` (owner-only).
   - Creates `select_all_profiles` allowing any authenticated user to SELECT.
   - INSERT / UPDATE / DELETE policies on profiles are unchanged (owner-only).
2. No new tables. The existing `conversations` and `messages` tables (created in
   an earlier migration) already support 1:1 messaging with proper RLS.

## Security
- profiles is now readable by every authenticated user. This is intentional:
  the app is a directory + messaging platform where users must see the names and
  roles of the people they chat with and the professionals they can book. Only
  the owner can still create / modify / delete a profile.
- `USING (true)` is used here ONLY because the profile data is intentionally
  shared among authenticated users — it is not a fallback around ownership.
- No changes to conversations / messages RLS: a user still only sees
  conversations they are a participant in and messages within those.

## Notes
1. Idempotent: DROP IF EXISTS before CREATE on the policy.
2. The email-invite verification itself is handled by an edge function
   (`verify-invite`) that validates a Supabase OTP code with the service role
   and creates the conversation server-side, so the inviter's session is never
   disturbed.
*/

DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "select_all_profiles" ON public.profiles;

CREATE POLICY "select_all_profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);