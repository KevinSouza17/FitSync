-- 1. Fix trending_hashtags view: expand to 30 days so hashtags show up
CREATE OR REPLACE VIEW trending_hashtags AS
SELECT h.id, h.tag, (count(ph.id))::integer AS post_count
FROM hashtags h
JOIN post_hashtags ph ON ph.hashtag_id = h.id
WHERE ph.created_at >= now() - interval '30 days'
GROUP BY h.id, h.tag
ORDER BY (count(ph.id))::integer DESC, h.tag
LIMIT 20;

-- 2. Fix trending_hashtags_enhanced view: expand to 30 days
CREATE OR REPLACE VIEW trending_hashtags_enhanced AS
WITH recent_posts AS (
  SELECT
    h.id AS hashtag_id,
    h.tag,
    count(DISTINCT CASE WHEN p.created_at > now() - interval '24 hours' THEN p.id END) AS posts_24h,
    count(DISTINCT CASE WHEN p.created_at > now() - interval '30 days' THEN p.id END) AS posts_7d,
    count(DISTINCT CASE WHEN p.created_at > now() - interval '24 hours' THEN l.id END) AS likes_24h,
    count(DISTINCT CASE WHEN p.created_at > now() - interval '24 hours' THEN c.id END) AS comments_24h
  FROM hashtags h
  JOIN post_hashtags ph ON ph.hashtag_id = h.id
  JOIN feed_posts p ON p.id = ph.post_id
  LEFT JOIN feed_likes l ON l.post_id = p.id
  LEFT JOIN feed_comments c ON c.post_id = p.id
  WHERE p.created_at > now() - interval '30 days'
  GROUP BY h.id, h.tag
)
SELECT
  tag,
  posts_24h,
  posts_7d,
  likes_24h,
  comments_24h,
  ((posts_24h * 3 + posts_7d * 1 + likes_24h * 2)::numeric + comments_24h::numeric * 1.5) AS trending_score,
  (posts_24h + posts_7d) AS post_count
FROM recent_posts
ORDER BY ((posts_24h * 3 + posts_7d * 1 + likes_24h * 2)::numeric + comments_24h::numeric * 1.5) DESC;

-- Grant access
GRANT SELECT ON trending_hashtags TO authenticated;
GRANT SELECT ON trending_hashtags_enhanced TO authenticated;

-- 3. Fix get_trending_posts function: fix type mismatch and expand to 7 days
CREATE OR REPLACE FUNCTION get_trending_posts(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  content text,
  image_url text,
  video_url text,
  media_type text,
  created_at timestamptz,
  full_name text,
  avatar_url text,
  trending_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.content,
    p.image_url,
    p.video_url,
    p.media_type,
    p.created_at,
    prof.full_name,
    prof.avatar_url,
    (
      (SELECT COUNT(*)::numeric FROM feed_likes l WHERE l.post_id = p.id) * 2 +
      (SELECT COUNT(*)::numeric FROM feed_comments c WHERE c.post_id = p.id) * 3
    ) AS trending_score
  FROM feed_posts p
  JOIN profiles prof ON prof.id = p.user_id
  WHERE prof.is_banned = false
    AND p.created_at > now() - interval '7 days'
  ORDER BY trending_score DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_trending_posts(integer) TO authenticated;
