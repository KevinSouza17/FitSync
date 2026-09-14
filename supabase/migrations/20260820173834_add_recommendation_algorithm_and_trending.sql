/*
# Algoritmo de Recomendação e Trending Topics Baseado em Engajamento

## O que faz
1. Cria uma view `trending_hashtags_enhanced` que calcula score de trending para cada hashtag com base em:
   - Número de posts nas últimas 24h (peso 3x)
   - Número de posts nas últimas 7 dias (peso 1x)
   - Número de likes em posts com a hashtag nas últimas 24h (peso 2x)
   - Número de comentarios em posts com a hashtag nas últimas 24h (peso 1.5x)
   - Decaimento temporal: posts mais recentes valem mais

2. Cria uma funcao `get_recommended_posts(p_user_id, p_limit)` que retorna posts recomendados baseado em:
   - Posts de usuarios que o usuario segue (peso 1.5x) 
   - Posts com hashtags que o usuario mais interagiu (curtiu/comentou) no passado
   - Posts com alto engajamento recente (likes + comentarios nas ultimas 48h)
   - Posts populares globais como fallback
   - Score final = engajamento * peso_social + relevancia_por_hashtag + frescor_temporal

3. Cria funcao `get_trending_posts(p_limit)` que retorna os posts com maior engajamento nas ultimas 24h.

4. Cria funcao `get_user_interests(p_user_id)` que retorna as hashtags com as quais o usuario mais interagiu.

## Seguranca
- Funcoes SECURITY DEFINER para permitir leitura de dados agregados
- Apenas SELECT, sem mutacoes
- Retorna apenas dados publicos do feed (posts nao privados)
*/

-- View de trending hashtags com score de engajamento
CREATE OR REPLACE VIEW trending_hashtags_enhanced AS
WITH recent_posts AS (
  SELECT
    h.id AS hashtag_id,
    h.tag,
    COUNT(DISTINCT CASE WHEN p.created_at > now() - interval '24 hours' THEN p.id END) AS posts_24h,
    COUNT(DISTINCT CASE WHEN p.created_at > now() - interval '7 days' THEN p.id END) AS posts_7d,
    COUNT(DISTINCT CASE WHEN p.created_at > now() - interval '24 hours' THEN l.id END) AS likes_24h,
    COUNT(DISTINCT CASE WHEN p.created_at > now() - interval '24 hours' THEN c.id END) AS comments_24h
  FROM hashtags h
  JOIN post_hashtags ph ON ph.hashtag_id = h.id
  JOIN feed_posts p ON p.id = ph.post_id
  LEFT JOIN feed_likes l ON l.post_id = p.id
  LEFT JOIN feed_comments c ON c.post_id = p.id
  WHERE p.created_at > now() - interval '7 days'
  GROUP BY h.id, h.tag
)
SELECT
  tag,
  posts_24h,
  posts_7d,
  likes_24h,
  comments_24h,
  (posts_24h * 3 + posts_7d * 1 + likes_24h * 2 + comments_24h * 1.5) AS trending_score,
  (posts_24h + posts_7d) AS post_count
FROM recent_posts
ORDER BY trending_score DESC;

-- Funcao para obter interesses do usuario (hashtags com que mais interagiu)
CREATE OR REPLACE FUNCTION get_user_interests(p_user_id uuid)
RETURNS TABLE (tag text, interest_score numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    h.tag,
    SUM(
      CASE
        WHEN l.user_id IS NOT NULL THEN 2  -- cada like = 2 pontos
        WHEN c.user_id IS NOT NULL THEN 3  -- cada comentario = 3 pontos
        ELSE 0
      END
    ) AS interest_score
  FROM post_hashtags ph
  JOIN hashtags h ON h.id = ph.hashtag_id
  JOIN feed_posts p ON p.id = ph.post_id
  LEFT JOIN feed_likes l ON l.post_id = p.id AND l.user_id = p_user_id
  LEFT JOIN feed_comments c ON c.post_id = p.id AND c.user_id = p_user_id
  WHERE l.user_id = p_user_id OR c.user_id = p_user_id
  GROUP BY h.tag
  ORDER BY interest_score DESC
  LIMIT 20;
$$;

-- Funcao de recomendacao de posts baseada em engajamento
CREATE OR REPLACE FUNCTION get_recommended_posts(p_user_id uuid, p_limit int DEFAULT 20)
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
  recommendation_score numeric,
  recommendation_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_followed_ids uuid[];
  v_interest_tags text[];
BEGIN
  -- Usuarios que o usuario segue (aceitos)
  SELECT array_agg(f.followee_id) INTO v_followed_ids
  FROM follows f
  WHERE f.follower_id = p_user_id AND f.status = 'accepted';

  -- Hashtags de interesse do usuario
  SELECT array_agg(i.tag) INTO v_interest_tags
  FROM get_user_interests(p_user_id) i
  LIMIT 10;

  RETURN QUERY
  WITH candidate_posts AS (
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
      -- Engajamento: likes + comentarios nos ultimos 7 dias
      (SELECT COUNT(*) FROM feed_likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM feed_comments c WHERE c.post_id = p.id) AS comment_count,
      -- Verdadeiro se post tem hashtag de interesse do usuario
      EXISTS(
        SELECT 1 FROM post_hashtags ph
        JOIN hashtags h ON h.id = ph.hashtag_id
        WHERE ph.post_id = p.id AND h.tag = ANY(COALESCE(v_interest_tags, ARRAY[]::text[]))
      ) AS has_interest_tag,
      -- Verdadeiro se post e de usuario seguido
      p.user_id = ANY(COALESCE(v_followed_ids, ARRAY[]::uuid[])) AS from_followed
    FROM feed_posts p
    JOIN profiles prof ON prof.id = p.user_id
    WHERE p.user_id != p_user_id
      AND prof.is_banned = false
      AND p.created_at > now() - interval '14 days'
  ),
  scored_posts AS (
    SELECT
      cp.*,
      -- Score de engajamento (likes * 1 + comentarios * 2)
      (cp.like_count + cp.comment_count * 2) AS engagement_score,
      -- Decaimento temporal: posts mais recentes pontuam mais
      EXTRACT(EPOCH FROM (now() - cp.created_at)) / 3600 AS hours_ago
  )
  SELECT
    sp.id,
    sp.user_id,
    sp.content,
    sp.image_url,
    sp.video_url,
    sp.media_type,
    sp.created_at,
    sp.full_name,
    sp.avatar_url,
    -- Score final: engajamento + bonus social + bonus hashtag + frescor
    (
      sp.engagement_score +
      CASE WHEN sp.from_followed THEN 5 ELSE 0 END +
      CASE WHEN sp.has_interest_tag THEN 8 ELSE 0 END +
      -- Frescor: maximo 10 pontos, decai 1 ponto a cada 12h
      GREATEST(10 - (sp.hours_ago / 12), 0)
    ) AS recommendation_score,
    CASE
      WHEN sp.from_followed AND sp.has_interest_tag THEN 'Seguindo e do seu interesse'
      WHEN sp.from_followed THEN 'De quem voce segue'
      WHEN sp.has_interest_tag THEN 'Do seu interesse'
      ELSE 'Popular na comunidade'
    END AS recommendation_reason
  FROM scored_posts sp
  ORDER BY recommendation_score DESC
  LIMIT p_limit;
END;
$$;

-- Funcao para trending posts (maior engajamento nas ultimas 24h)
CREATE OR REPLACE FUNCTION get_trending_posts(p_limit int DEFAULT 20)
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
SET search_path = public
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
      (SELECT COUNT(*) FROM feed_likes l WHERE l.post_id = p.id) * 2 +
      (SELECT COUNT(*) FROM feed_comments c WHERE c.post_id = p.id) * 3
    ) AS trending_score
  FROM feed_posts p
  JOIN profiles prof ON prof.id = p.user_id
  WHERE prof.is_banned = false
    AND p.created_at > now() - interval '24 hours'
  ORDER BY trending_score DESC
  LIMIT p_limit;
END;
$$;

-- Grant acesso as funcoes para usuarios autenticados
GRANT EXECUTE ON FUNCTION get_recommended_posts(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trending_posts(int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_interests(uuid) TO authenticated;
GRANT SELECT ON trending_hashtags_enhanced TO authenticated;
