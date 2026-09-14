/*
# Workout system, custom foods, and food history

## Summary
Adds a complete customizable weekly workout protocol with exercise progression
tracking, user-created custom foods with barcode support, and a food history
view. This expands the app from a simple daily checklist to a full training
planner with load progression charts.

## New Tables

### workout_programs
- id (uuid, pk)
- user_id (uuid, not null, defaults auth.uid()) — owner
- name (text) — e.g. "Push/Pull/Legs"
- description (text)
- is_active (boolean, default false) — only one active program per user
- created_at (timestamptz)

### workout_days
- id (uuid, pk)
- program_id (uuid, fk → workout_programs)
- day_of_week (int, 0=Sunday..6=Saturday)
- label (text) — e.g. "Push A", "Pull B", "Legs"
- created_at (timestamptz)

### workout_exercises
- id (uuid, pk)
- program_day_id (uuid, fk → workout_days)
- exercise_name (text, not null)
- target_sets (int, default 3)
- target_reps_min (int, default 8)
- target_reps_max (int, default 12)
- rest_seconds (int, default 90)
- sort_order (int, default 0)
- notes (text)

### workout_logs
- id (uuid, pk)
- user_id (uuid, not null, defaults auth.uid()) — owner
- program_exercise_id (uuid, fk → workout_exercises, nullable for deleted exercises)
- exercise_name (text, not null) — denormalized for history after exercise deletion
- workout_day_id (uuid, fk → workout_days, nullable)
- sets_completed (int)
- reps_per_set (text) — e.g. "10,10,8"
- weight_kg (numeric, default 0)
- logged_date (date, not null)
- notes (text)
- created_at (timestamptz)

### custom_foods
- id (uuid, pk)
- user_id (uuid, not null, defaults auth.uid()) — owner
- name (text, not null)
- category (text, not null)
- serving_size (text, default '100g')
- calories (int, default 0)
- protein_g (numeric(6,1), default 0)
- carbs_g (numeric(6,1), default 0)
- fat_g (numeric(6,1), default 0)
- fiber_g (numeric(6,1), default 0)
- barcode (text, nullable) — EAN/UPC barcode for scanning
- is_recipe (boolean, default false) — true for user-created recipes
- ingredients (text, nullable) — recipe ingredients as free text
- created_at (timestamptz)

## Security
- All new tables have RLS enabled.
- workout_programs, workout_logs, custom_foods: owner-scoped (auth.uid() = user_id).
- workout_days, workout_exercises: scoped through parent program ownership via
  EXISTS subquery on workout_programs.user_id = auth.uid().
- 4 separate policies per table (select/insert/update/delete).
- user_id columns default to auth.uid() so client inserts work without passing owner.

## Notes
1. Idempotent: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS before CREATE.
2. workout_logs stores exercise_name denormalized so history survives exercise deletion.
3. custom_foods supports barcode for future barcode-scanning integration.
4. is_recipe flag distinguishes simple custom foods from full recipes with ingredients.
*/
CREATE TABLE IF NOT EXISTS public.workout_programs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT 'Meu Programa',
  description text,
  is_active   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workout_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_programs" ON public.workout_programs;
CREATE POLICY "select_own_programs" ON public.workout_programs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_programs" ON public.workout_programs;
CREATE POLICY "insert_own_programs" ON public.workout_programs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_programs" ON public.workout_programs;
CREATE POLICY "update_own_programs" ON public.workout_programs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_programs" ON public.workout_programs;
CREATE POLICY "delete_own_programs" ON public.workout_programs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.workout_days (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid NOT NULL REFERENCES public.workout_programs(id) ON DELETE CASCADE,
  day_of_week int  NOT NULL DEFAULT 1 CHECK (day_of_week BETWEEN 0 AND 6),
  label       text NOT NULL DEFAULT 'Treino',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workout_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_workout_days" ON public.workout_days;
CREATE POLICY "select_own_workout_days" ON public.workout_days FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_programs p WHERE p.id = program_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_workout_days" ON public.workout_days;
CREATE POLICY "insert_own_workout_days" ON public.workout_days FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_programs p WHERE p.id = program_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_workout_days" ON public.workout_days;
CREATE POLICY "update_own_workout_days" ON public.workout_days FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_programs p WHERE p.id = program_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_programs p WHERE p.id = program_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_workout_days" ON public.workout_days;
CREATE POLICY "delete_own_workout_days" ON public.workout_days FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_programs p WHERE p.id = program_id AND p.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.workout_exercises (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_day_id   uuid NOT NULL REFERENCES public.workout_days(id) ON DELETE CASCADE,
  exercise_name    text NOT NULL,
  target_sets      int  NOT NULL DEFAULT 3,
  target_reps_min  int  NOT NULL DEFAULT 8,
  target_reps_max  int  NOT NULL DEFAULT 12,
  rest_seconds     int  NOT NULL DEFAULT 90,
  sort_order       int  NOT NULL DEFAULT 0,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_workout_exercises" ON public.workout_exercises;
CREATE POLICY "select_own_workout_exercises" ON public.workout_exercises FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_days d JOIN public.workout_programs p ON p.id = d.program_id WHERE d.id = program_day_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_own_workout_exercises" ON public.workout_exercises;
CREATE POLICY "insert_own_workout_exercises" ON public.workout_exercises FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_days d JOIN public.workout_programs p ON p.id = d.program_id WHERE d.id = program_day_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_own_workout_exercises" ON public.workout_exercises;
CREATE POLICY "update_own_workout_exercises" ON public.workout_exercises FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_days d JOIN public.workout_programs p ON p.id = d.program_id WHERE d.id = program_day_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_days d JOIN public.workout_programs p ON p.id = d.program_id WHERE d.id = program_day_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_workout_exercises" ON public.workout_exercises;
CREATE POLICY "delete_own_workout_exercises" ON public.workout_exercises FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_days d JOIN public.workout_programs p ON p.id = d.program_id WHERE d.id = program_day_id AND p.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.workout_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  program_exercise_id uuid REFERENCES public.workout_exercises(id) ON DELETE SET NULL,
  exercise_name       text NOT NULL,
  workout_day_id      uuid REFERENCES public.workout_days(id) ON DELETE SET NULL,
  sets_completed      int NOT NULL DEFAULT 3,
  reps_per_set        text,
  weight_kg           numeric(6,1) NOT NULL DEFAULT 0,
  logged_date         date NOT NULL DEFAULT CURRENT_DATE,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workout_logs_user_date_idx ON public.workout_logs (user_id, logged_date DESC);
CREATE INDEX IF NOT EXISTS workout_logs_exercise_idx ON public.workout_logs (user_id, exercise_name, logged_date DESC);
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_workout_logs" ON public.workout_logs;
CREATE POLICY "select_own_workout_logs" ON public.workout_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_workout_logs" ON public.workout_logs;
CREATE POLICY "insert_own_workout_logs" ON public.workout_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_workout_logs" ON public.workout_logs;
CREATE POLICY "update_own_workout_logs" ON public.workout_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_workout_logs" ON public.workout_logs;
CREATE POLICY "delete_own_workout_logs" ON public.workout_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.custom_foods (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  category     text NOT NULL DEFAULT 'Personalizado',
  serving_size text NOT NULL DEFAULT '100g',
  calories     int NOT NULL DEFAULT 0,
  protein_g    numeric(6,1) NOT NULL DEFAULT 0,
  carbs_g      numeric(6,1) NOT NULL DEFAULT 0,
  fat_g        numeric(6,1) NOT NULL DEFAULT 0,
  fiber_g      numeric(6,1) NOT NULL DEFAULT 0,
  barcode      text,
  is_recipe    boolean NOT NULL DEFAULT false,
  ingredients  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS custom_foods_user_idx ON public.custom_foods (user_id);
CREATE INDEX IF NOT EXISTS custom_foods_barcode_idx ON public.custom_foods (barcode);
ALTER TABLE public.custom_foods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_custom_foods" ON public.custom_foods;
CREATE POLICY "select_own_custom_foods" ON public.custom_foods FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_custom_foods" ON public.custom_foods;
CREATE POLICY "insert_own_custom_foods" ON public.custom_foods FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_custom_foods" ON public.custom_foods;
CREATE POLICY "update_own_custom_foods" ON public.custom_foods FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_custom_foods" ON public.custom_foods;
CREATE POLICY "delete_own_custom_foods" ON public.custom_foods FOR DELETE TO authenticated USING (auth.uid() = user_id);