-- Allow anon to read site_reviews (for login page rating display)
CREATE POLICY "select_site_reviews_anon" ON site_reviews FOR SELECT
  TO anon USING (true);
