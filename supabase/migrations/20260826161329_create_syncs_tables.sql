-- Syncs: short-form videos (up to 3 minutes) like Instagram Reels

-- Syncs table
CREATE TABLE IF NOT EXISTS syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  caption text,
  music_track text,
  duration_seconds integer DEFAULT 0,
  view_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sync likes
CREATE TABLE IF NOT EXISTS sync_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_id uuid NOT NULL REFERENCES syncs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sync_id, user_id)
);

-- Sync comments
CREATE TABLE IF NOT EXISTS sync_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_id uuid NOT NULL REFERENCES syncs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_syncs_created_at ON syncs(created_at DESC);
CREATE INDEX idx_sync_likes_sync_id ON sync_likes(sync_id);
CREATE INDEX idx_sync_comments_sync_id ON sync_comments(sync_id DESC);

-- Enable RLS
ALTER TABLE syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_comments ENABLE ROW LEVEL SECURITY;

-- Syncs policies
CREATE POLICY "select_syncs" ON syncs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_own_syncs" ON syncs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_syncs" ON syncs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_syncs" ON syncs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Sync likes policies
CREATE POLICY "select_sync_likes" ON sync_likes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_own_sync_likes" ON sync_likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_sync_likes" ON sync_likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Sync comments policies
CREATE POLICY "select_sync_comments" ON sync_comments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_own_sync_comments" ON sync_comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_sync_comments" ON sync_comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Storage bucket for syncs
INSERT INTO storage.buckets (id, name, public) VALUES ('syncs', 'syncs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for syncs bucket
CREATE POLICY "upload_own_syncs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'syncs' AND auth.uid() = (storage.foldername(name))[1]::uuid);

CREATE POLICY "read_syncs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'syncs');

CREATE POLICY "delete_own_syncs_storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'syncs' AND auth.uid() = (storage.foldername(name))[1]::uuid);

-- Increment view count function
CREATE OR REPLACE FUNCTION increment_sync_view(p_sync_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE syncs SET view_count = view_count + 1 WHERE id = p_sync_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_sync_view(uuid) TO authenticated;
