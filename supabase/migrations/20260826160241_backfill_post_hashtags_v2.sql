-- Backfill missing post_hashtags for existing posts that have #hashtags in content
-- but no entry in post_hashtags
DO $$
DECLARE
  post_rec RECORD;
  tag_match text;
  tag_text text;
  tag_id uuid;
  existing_id uuid;
BEGIN
  FOR post_rec IN SELECT id, content FROM feed_posts WHERE content ~ '#' LOOP
    FOR tag_match IN SELECT unnest(regexp_matches(post_rec.content, '#([\w\u00C0-\u024F]+)', 'g')) LOOP
      tag_text := lower(substring(tag_match from 2));
      -- Get or create hashtag
      SELECT id INTO tag_id FROM hashtags WHERE tag = tag_text LIMIT 1;
      IF tag_id IS NULL THEN
        INSERT INTO hashtags (tag) VALUES (tag_text) RETURNING id INTO tag_id;
      END IF;
      -- Check if post_hashtags already exists
      SELECT id INTO existing_id FROM post_hashtags WHERE post_id = post_rec.id AND hashtag_id = tag_id LIMIT 1;
      IF existing_id IS NULL THEN
        INSERT INTO post_hashtags (post_id, hashtag_id) VALUES (post_rec.id, tag_id);
      END IF;
    END LOOP;
  END LOOP;
END $$;
