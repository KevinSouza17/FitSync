/*
# Update community_recipes_with_ratings view to include is_official

## Changes
1. Recreate the `community_recipes_with_ratings` view to include the
   new `is_official` column so the frontend can display "Adicionada por
   FitSync" for system-seeded recipes.
*/

DROP VIEW IF EXISTS public.community_recipes_with_ratings;

CREATE VIEW public.community_recipes_with_ratings AS
SELECT r.id,
       r.user_id,
       r.title,
       r.description,
       r.ingredients,
       r.instructions,
       r.prep_time_min,
       r.servings,
       r.calories,
       r.protein_g,
       r.carbs_g,
       r.fat_g,
       r.image_url,
       r.created_at,
       r.is_official,
       COALESCE(rr.ratings_count, 0) AS ratings_count,
       COALESCE(rr.ratings_sum, 0) AS ratings_sum
FROM community_recipes r
LEFT JOIN (
  SELECT recipe_id,
         count(*) AS ratings_count,
         sum(rating) AS ratings_sum
  FROM recipe_ratings
  GROUP BY recipe_id
) rr ON rr.recipe_id = r.id;

GRANT SELECT ON public.community_recipes_with_ratings TO authenticated;
