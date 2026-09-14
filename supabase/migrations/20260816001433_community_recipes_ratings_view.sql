CREATE OR REPLACE VIEW public.community_recipes_with_ratings AS
SELECT
  r.*,
  COALESCE(rr.ratings_count, 0) AS ratings_count,
  COALESCE(rr.ratings_sum, 0) AS ratings_sum
FROM public.community_recipes r
LEFT JOIN (
  SELECT recipe_id, COUNT(*) AS ratings_count, SUM(rating) AS ratings_sum
  FROM public.recipe_ratings
  GROUP BY recipe_id
) rr ON rr.recipe_id = r.id;

GRANT SELECT ON public.community_recipes_with_ratings TO authenticated;
