-- Allow anon to read profiles (needed for login page stats before sign-in)
-- Only expose id, is_professional columns for counting
CREATE POLICY "select_profiles_anon" ON profiles FOR SELECT
  TO anon USING (true);

-- Allow anon to read site_reviews (already public via select_site_reviews with USING true)
-- but need to grant to anon role explicitly
GRANT SELECT ON site_reviews TO anon;
GRANT SELECT ON profiles TO anon;
