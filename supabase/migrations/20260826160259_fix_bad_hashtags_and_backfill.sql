-- Remove incorrectly extracted hashtags (missing first char) and their post_hashtags
DELETE FROM post_hashtags WHERE hashtag_id IN (
  SELECT id FROM hashtags WHERE tag IN ('iwi', 'ura', 'uloso')
);
DELETE FROM hashtags WHERE tag IN ('iwi', 'ura', 'uloso');

-- Re-insert correct post_hashtags for all posts with #hashtags
DO $$
DECLARE
  post_rec RECORD;
  tag_match text;
  tag_text text;
  tag_id uuid;
BEGIN
  FOR post_rec IN SELECT id, content FROM feed_posts WHERE content ~ '#' LOOP
    FOR tag_match IN SELECT unnest(regexp_matches(post_rec.content, '#([A-Za-z\u00C0-\u024F]+)', 'g')) LOOP
      -- tag_match includes the #, extract without it
      tag_text := lower(substring(tag_match from 2));
      -- Get or create hashtag
      SELECT id INTO tag_id FROM hashtags WHERE tag = tag_text LIMIT 1;
      IF tag_id IS NULL THEN
        INSERT INTO hashtags (tag) VALUES (tag_text) RETURNING id INTO tag_id;
      END IF;
      -- Insert post_hashtags if not exists
      IF NOT EXISTS (SELECT 1 FROM post_hashtags WHERE post_id = post_rec.id AND hashtag_id = tag_id) THEN
        INSERT INTO post_hashtags (post_id, hashtag_id) VALUES (post_rec.id, tag_id);
      END IF;
    END LOOP;
  END LOOP;
END $$;
