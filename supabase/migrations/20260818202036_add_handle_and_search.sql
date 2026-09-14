/*
# Add @handle to profiles + search function

## Context
Finding people by email is cumbersome. We want users to have a short @handle
(derived from their name) that can be searched and used to follow people.

## Changes
### profiles (ALTER, no data loss)
- `handle` text — a unique-ish username like "joaosilva". NULL until set.

### Function: search_profiles(p_query text, p_limit int)
SECURITY DEFINER. Returns profiles matching a handle or name prefix, excluding
the caller and banned users. Used by the people-search UI.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS handle text;

-- Backfill handles from full_name for existing users (lowercase, alphanumeric)
UPDATE profiles
SET handle = lower(regexp_replace(full_name, '[^a-zA-Z0-9]', '', 'g'))
WHERE handle IS NULL
  AND full_name IS NOT NULL
  AND full_name <> '';

CREATE INDEX IF NOT EXISTS profiles_handle_idx ON profiles (lower(handle));

CREATE OR REPLACE FUNCTION search_profiles(p_query text, p_limit int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  is_professional boolean,
  professional_role text,
  handle text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    p.is_professional,
    p.professional_role,
    p.handle
  FROM profiles p
  WHERE p.id <> auth.uid()
    AND p.is_banned = false
    AND (
      p.handle ILIKE p_query || '%'
      OR p.full_name ILIKE '%' || p_query || '%'
    )
  ORDER BY
    (p.handle ILIKE p_query || '%') DESC,
    p.full_name ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION search_profiles(text, int) TO authenticated;
