/*
# Auto-create profile on user signup

## Summary
Guarantees that every user created in `auth.users` gets a matching row in `profiles`,
so the app never reaches an authenticated state with a missing profile (which left the
dashboard showing empty/default data and made the app appear broken).

## How it works
1. A trigger function `handle_new_user()` inserts a minimal profile row (id only; all
   other columns fall back to their defined defaults) every time a row is inserted into
   `auth.users`. It runs as SECURITY DEFINER (postgres), bypassing RLS, so it works even
   before the client has an authenticated session.
2. The trigger `on_auth_user_created` fires AFTER INSERT on `auth.users`.
3. A one-time backfill inserts profile rows for the two existing users who registered
   without a profile being created.

## Security
- The trigger function is SECURITY DEFINER with `search_path = public` — it can only
  insert a row whose id matches the new auth user, so it cannot be abused to create
  arbitrary profiles.
- No changes to existing RLS policies. The client-side upsert (in AuthContext) still
  runs as the authenticated user and is scoped by the existing ownership policies.

## Notes
1. `ON CONFLICT (id) DO NOTHING` makes both the trigger and the backfill idempotent —
   safe to re-run.
2. The client is still responsible for setting `full_name` and professional fields via
   an upsert after signUp; the trigger only guarantees the base row exists.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing users who have none
INSERT INTO public.profiles (id)
SELECT u.id FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
