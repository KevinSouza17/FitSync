CREATE OR REPLACE FUNCTION public.check_and_grant_achievements(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meal_count int;
  v_post_count int;
  v_recipe_count int;
  v_workout_count int;
  v_water_total numeric;
  v_follower_count int;
  v_ach record;
BEGIN
  -- Count user activity
  SELECT count(*) INTO v_meal_count FROM meals WHERE user_id = p_user_id;
  SELECT count(*) INTO v_post_count FROM feed_posts WHERE user_id = p_user_id;
  SELECT count(*) INTO v_recipe_count FROM community_recipes WHERE user_id = p_user_id;
  SELECT count(*) INTO v_workout_count FROM workout_logs WHERE user_id = p_user_id;
  SELECT COALESCE(SUM(amount_liters), 0) INTO v_water_total FROM water_logs WHERE user_id = p_user_id;
  SELECT count(*) INTO v_follower_count FROM follows WHERE followee_id = p_user_id AND status = 'accepted';

  -- first_meal: registered at least 1 meal
  IF v_meal_count >= 1 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    SELECT p_user_id, id FROM achievements WHERE code = 'first_meal'
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  -- first_post: made at least 1 feed post
  IF v_post_count >= 1 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    SELECT p_user_id, id FROM achievements WHERE code = 'first_post'
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  -- first_recipe: shared at least 1 recipe
  IF v_recipe_count >= 1 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    SELECT p_user_id, id FROM achievements WHERE code = 'first_recipe'
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  -- recipe_master: shared at least 5 recipes
  IF v_recipe_count >= 5 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    SELECT p_user_id, id FROM achievements WHERE code = 'recipe_master'
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  -- workout_warrior: completed at least 10 workouts
  IF v_workout_count >= 10 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    SELECT p_user_id, id FROM achievements WHERE code = 'workout_warrior'
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  -- hydration_hero: drank at least 30L total
  IF v_water_total >= 30 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    SELECT p_user_id, id FROM achievements WHERE code = 'hydration_hero'
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  -- social_butterfly: has at least 10 followers
  IF v_follower_count >= 10 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    SELECT p_user_id, id FROM achievements WHERE code = 'social_butterfly'
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  -- early_adopter: account created before 2026-09-01
  IF EXISTS (
    SELECT 1 FROM profiles WHERE id = p_user_id AND created_at < '2026-09-01'::timestamptz
  ) THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    SELECT p_user_id, id FROM achievements WHERE code = 'early_adopter'
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_grant_achievements(uuid) TO authenticated;
