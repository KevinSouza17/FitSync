-- Achievements system + community recipes + ratings
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'Trophy',
  tier text NOT NULL DEFAULT 'bronze',
  xp_reward integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ua_select ON public.user_achievements;
CREATE POLICY ua_select ON public.user_achievements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ua_insert_own ON public.user_achievements;
CREATE POLICY ua_insert_own ON public.user_achievements FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.community_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  ingredients text NOT NULL,
  instructions text NOT NULL,
  prep_time_min integer DEFAULT 0,
  servings int DEFAULT 1,
  calories int DEFAULT 0,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fat_g numeric DEFAULT 0,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cr_select ON public.community_recipes;
CREATE POLICY cr_select ON public.community_recipes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cr_insert_own ON public.community_recipes;
CREATE POLICY cr_insert_own ON public.community_recipes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS cr_update_own ON public.community_recipes;
CREATE POLICY cr_update_own ON public.community_recipes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS cr_delete_own ON public.community_recipes;
CREATE POLICY cr_delete_own ON public.community_recipes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.recipe_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.community_recipes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, user_id)
);
ALTER TABLE public.recipe_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rr_select ON public.recipe_ratings;
CREATE POLICY rr_select ON public.recipe_ratings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS rr_insert_own ON public.recipe_ratings;
CREATE POLICY rr_insert_own ON public.recipe_ratings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS rr_update_own ON public.recipe_ratings;
CREATE POLICY rr_update_own ON public.recipe_ratings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS rr_delete_own ON public.recipe_ratings;
CREATE POLICY rr_delete_own ON public.recipe_ratings FOR DELETE TO authenticated USING (user_id = auth.uid());

INSERT INTO public.achievements (code, title, description, icon, tier, xp_reward) VALUES
  ('first_meal', 'Primeira Refeição', 'Registre sua primeira refeição no diário', 'UtensilsCrossed', 'bronze', 10),
  ('week_streak', 'Semana Perfeita', 'Use o app por 7 dias seguidos', 'Flame', 'silver', 50),
  ('first_post', 'Primeira Postagem', 'Faça sua primeira postagem no feed', 'Newspaper', 'bronze', 10),
  ('first_recipe', 'Chef Iniciante', 'Compartilhe sua primeira receita', 'ChefHat', 'bronze', 15),
  ('goal_smasher', 'Quebrador de Metas', 'Complete uma meta', 'Target', 'silver', 40),
  ('social_butterfly', 'Borboleta Social', 'Tenha 10 seguidores', 'Users', 'silver', 50),
  ('workout_warrior', 'Guerreiro do Treino', 'Complete 10 treinos', 'Dumbbell', 'gold', 100),
  ('hydration_hero', 'Herói da Hidratação', 'Beba 30L de água no total', 'Droplets', 'silver', 40),
  ('recipe_master', 'Mestre Cuca', 'Compartilhe 5 receitas', 'ChefHat', 'gold', 80),
  ('early_adopter', 'Pioneiro', 'Seja um dos primeiros usuários', 'Star', 'bronze', 10)
ON CONFLICT (code) DO NOTHING;
