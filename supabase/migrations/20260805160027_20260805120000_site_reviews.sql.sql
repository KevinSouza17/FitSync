/*
# Site Reviews Table

## What this migration does

Creates a `site_reviews` table where authenticated users can leave a public
review of the platform (star rating + comment). Only real data saved by users
is shown — nothing is seeded or hardcoded.

## New Table

### site_reviews
- id (uuid PK)
- user_id (uuid, DEFAULT auth.uid(), references profiles.id, ON DELETE CASCADE)
- rating (integer 1-5, not null)
- comment (text, not null)
- created_at (timestamptz, default now())

## Security

- RLS enabled.
- Any authenticated user can SELECT all reviews (they are public).
- Only the owner can INSERT their own review (one per user via UNIQUE constraint).
- Only the owner can DELETE their own review.
- UPDATE is not allowed — users should delete and re-create to change their rating.
*/

CREATE TABLE IF NOT EXISTS site_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE site_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_site_reviews" ON site_reviews;
CREATE POLICY "select_site_reviews" ON site_reviews FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_site_review" ON site_reviews;
CREATE POLICY "insert_own_site_review" ON site_reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_site_review" ON site_reviews;
CREATE POLICY "delete_own_site_review" ON site_reviews FOR DELETE
  TO authenticated USING (auth.uid() = user_id);