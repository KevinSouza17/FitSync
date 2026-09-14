-- Replace the public SELECT policy on feed_posts so private profiles
-- only expose posts to accepted followers, the owner, and site owners.
DROP POLICY IF EXISTS select_feed_posts ON feed_posts;

CREATE POLICY select_feed_posts ON feed_posts
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = user_id AND COALESCE(p.is_private, false) = false
    )
    OR EXISTS (
      SELECT 1 FROM follows f
      WHERE f.followee_id = user_id
        AND f.follower_id = auth.uid()
        AND f.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1 FROM profiles op
      WHERE op.id = auth.uid() AND op.role = 'owner'
    )
  );
