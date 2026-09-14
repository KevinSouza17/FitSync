-- 1. Revoke UPDATE on sensitive columns of profiles from authenticated users
-- These columns carry privilege/moderation value and must never be client-writable.
REVOKE UPDATE (role, is_banned, verified, rating_avg, rating_count, plan, is_professional) ON profiles FROM authenticated;
REVOKE INSERT (role, is_banned, verified, rating_avg, rating_count) ON profiles FROM authenticated;

-- 2. Create SECURITY DEFINER function for owner to ban/unban users
CREATE OR REPLACE FUNCTION ban_user(p_target uuid, p_ban boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE profiles SET is_banned = p_ban WHERE id = p_target;
END;
$$;

REVOKE EXECUTE ON FUNCTION ban_user FROM anon;
GRANT EXECUTE ON FUNCTION ban_user TO authenticated;

-- 3. Create SECURITY DEFINER function for owner to delete any post
CREATE OR REPLACE FUNCTION delete_post_as_owner(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM feed_posts WHERE id = p_post_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_post_as_owner FROM anon;
GRANT EXECUTE ON FUNCTION delete_post_as_owner TO authenticated;

-- 4. Add video support to feed_posts
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'image';

-- 5. Add video MIME type constraint to storage (allow video uploads alongside images)
-- The storage bucket 'avatars' is already used for media; we just need to make sure
-- the existing policies allow video files too (they check bucket_id, not mime type).
