/*
# Add avatar_url to profiles + create avatars storage bucket

## Summary
Adds an avatar_url column to the profiles table so users can store a profile
photo URL (from Supabase Storage). Also creates a public storage bucket named
`avatars` for uploading profile photos, with a policy allowing authenticated
users to upload/read their own avatar.

## Changes
1. profiles table: new column `avatar_url` (text, nullable)
2. Storage: new public bucket `avatars`
3. Storage policies: authenticated users can upload/read/delete objects whose
   path starts with their own user id (e.g. `<uid>/avatar.jpg`)

## Security
- RLS already enabled on profiles; existing policies cover the new column.
- Storage policies restrict uploads to the owner's folder.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatar_upload_own" ON storage.objects;
CREATE POLICY "avatar_upload_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatar_read_all" ON storage.objects;
CREATE POLICY "avatar_read_all"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatar_update_own" ON storage.objects;
CREATE POLICY "avatar_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatar_delete_own" ON storage.objects;
CREATE POLICY "avatar_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
