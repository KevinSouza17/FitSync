/*
# Add get_email_by_user_id SECURITY DEFINER function

## Summary
The notify-message edge function needs the recipient's email to send a
new-message email notification. It currently tries to query auth.users
through the PostgREST REST API (serviceClient.from("auth.users")), but
PostgREST does NOT expose the auth schema — the query silently returns
null, so no email is ever sent.

This migration adds a SECURITY DEFINER function that reads the email
directly in SQL (bypassing RLS, same pattern as find_user_id_by_email),
so the edge function can resolve the recipient's email via RPC.

## New Functions
1. get_email_by_user_id(p_user_id uuid) → text
   Returns the email for the given auth.users id, or NULL.
   SECURITY DEFINER so it can read auth.users. Only returns the email,
   nothing else.

## Security
- SECURITY DEFINER, search_path = public.
- Only returns the email column, nothing sensitive.
- Callable by authenticated role (the edge function passes the service
  role key, which has access regardless).

## Notes
1. Idempotent: CREATE OR REPLACE.
2. Grants EXECUTE to authenticated so it can also be called from the
   client if needed in the future.
*/

CREATE OR REPLACE FUNCTION public.get_email_by_user_id(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = p_user_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_user_id(uuid) TO authenticated;
