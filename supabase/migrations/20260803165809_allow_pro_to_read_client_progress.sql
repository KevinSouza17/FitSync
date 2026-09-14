/*
# Allow professionals to read client progress data

## Summary
Professionals need to see their clients' progress (meals, weight logs, workout logs)
to monitor and adjust plans. This adds SELECT policies on meals, weight_logs, and
workout_logs that allow a professional to read data for any user who has an active
client_plans row where the professional is the creator.

## Modified Tables
None.

## Security
- Adds SELECT policies on meals, weight_logs, and workout_logs.
- A professional can SELECT rows where the user_id matches any client_id in
  client_plans where professional_id = auth.uid().
- Existing owner-based SELECT policies remain unchanged.
- No INSERT/UPDATE/DELETE changes — professionals can only READ client data.
*/

-- meals: allow professionals to read their clients' meals
DROP POLICY IF EXISTS "select_client_meals_as_pro" ON public.meals;
CREATE POLICY "select_client_meals_as_pro" ON public.meals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_plans
      WHERE client_plans.client_id = meals.user_id
        AND client_plans.professional_id = auth.uid()
    )
  );

-- weight_logs: allow professionals to read their clients' weight logs
DROP POLICY IF EXISTS "select_client_weight_logs_as_pro" ON public.weight_logs;
CREATE POLICY "select_client_weight_logs_as_pro" ON public.weight_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_plans
      WHERE client_plans.client_id = weight_logs.user_id
        AND client_plans.professional_id = auth.uid()
    )
  );

-- workout_logs: allow professionals to read their clients' workout logs
DROP POLICY IF EXISTS "select_client_workout_logs_as_pro" ON public.workout_logs;
CREATE POLICY "select_client_workout_logs_as_pro" ON public.workout_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_plans
      WHERE client_plans.client_id = workout_logs.user_id
        AND client_plans.professional_id = auth.uid()
    )
  );

-- water_logs: allow professionals to read their clients' water logs
DROP POLICY IF EXISTS "select_client_water_logs_as_pro" ON public.water_logs;
CREATE POLICY "select_client_water_logs_as_pro" ON public.water_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_plans
      WHERE client_plans.client_id = water_logs.user_id
        AND client_plans.professional_id = auth.uid()
    )
  );

-- profiles: allow professionals to read full profiles of their clients
DROP POLICY IF EXISTS "select_client_profile_as_pro" ON public.profiles;
CREATE POLICY "select_client_profile_as_pro" ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_plans
      WHERE client_plans.client_id = profiles.id
        AND client_plans.professional_id = auth.uid()
    )
  );
