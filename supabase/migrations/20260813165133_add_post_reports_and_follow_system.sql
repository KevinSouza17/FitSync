-- 1. Create post_reports table
CREATE TABLE IF NOT EXISTS post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (post_id, reporter_id)
);

ALTER TABLE post_reports ENABLE ROW LEVEL SECURITY;

-- Users can report posts (insert their own reports)
CREATE POLICY "insert_own_reports" ON post_reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- Users can see their own reports
CREATE POLICY "select_own_reports" ON post_reports FOR SELECT
  TO authenticated USING (auth.uid() = reporter_id);

-- Owner can see all reports
CREATE POLICY "select_all_reports_owner" ON post_reports FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
  );

-- Owner can update report status
CREATE POLICY "update_reports_owner" ON post_reports FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
  );

-- Owner can delete reports
CREATE POLICY "delete_reports_owner" ON post_reports FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
  );

-- 2. Create function to follow a user (auto-accept if public, pending if private)
CREATE OR REPLACE FUNCTION follow_user(p_followee_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_private boolean;
  v_status text;
BEGIN
  SELECT is_private INTO v_is_private FROM profiles WHERE id = p_followee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  
  v_status := CASE WHEN v_is_private THEN 'pending' ELSE 'accepted' END;
  
  INSERT INTO follows (follower_id, followee_id, status)
  VALUES (auth.uid(), p_followee_id, v_status)
  ON CONFLICT (follower_id, followee_id) DO UPDATE SET status = v_status;
  
  RETURN v_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION follow_user FROM anon;
GRANT EXECUTE ON FUNCTION follow_user TO authenticated;

-- 3. Grant update on is_private column to authenticated (needed for privacy toggle)
-- Already granted since is_private was in the original columns, but let's make sure
GRANT UPDATE (is_private) ON profiles TO authenticated;
