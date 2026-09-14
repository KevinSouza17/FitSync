-- Delete ALL bad hashtags and post_hashtags, then rebuild correctly
DELETE FROM post_hashtags;
DELETE FROM hashtags;

-- Rebuild from scratch using correct extraction
DO $$
DECLARE
  post_rec RECORD;
  tag_text text;
  tag_id uuid;
BEGIN
  FOR post_rec IN SELECT id, content FROM feed_posts WHERE content ~ '#' LOOP
    FOR tag_text IN SELECT m[1] FROM regexp_matches(post_rec.content, '#([A-Za-z\u00C0-\u024F]+)', 'g') AS m LOOP
      tag_text := lower(tag_text);
      SELECT id INTO tag_id FROM hashtags WHERE tag = tag_text LIMIT 1;
      IF tag_id IS NULL THEN
        INSERT INTO hashtags (tag) VALUES (tag_text) RETURNING id INTO tag_id;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM post_hashtags WHERE post_id = post_rec.id AND hashtag_id = tag_id) THEN
        INSERT INTO post_hashtags (post_id, hashtag_id) VALUES (post_rec.id, tag_id);
      END IF;
    END LOOP;
  END LOOP;
END $$;
