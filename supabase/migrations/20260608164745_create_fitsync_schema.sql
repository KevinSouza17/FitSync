
/*
# FitSync Full Application Schema

## Summary
Creates all tables needed to run the FitSync health-tracking app with per-user data isolation.
Every table uses `user_id DEFAULT auth.uid()` so the frontend can call `.insert({ ... })` without
manually passing the owner — the database fills it from the authenticated session.

## New Tables

### profiles
Extends `auth.users` with the user's health and display data.
Columns: id (matches auth.users.id), full_name, height_cm, weight_kg, goal_weight_kg,
health_goal, daily_calorie_goal, daily_water_goal_liters, activity_level, plan, created_at, updated_at.

### meals
One row per meal logged by a user on a given day.
Columns: id, user_id, name, meal_type (breakfast/lunch/dinner/snack), calories,
protein_g, carbs_g, fat_g, logged_date, created_at.

### diary_tasks
Daily to-do items the user tracks (hydration reminders, workout plans, etc).
Columns: id, user_id, text, done, category, task_date, sort_order, created_at.

### exercises
Individual exercises logged within a workout session.
Columns: id, user_id, name, sets, reps, weight_kg, done, workout_type, exercise_date, created_at.

### water_logs
Each time the user logs a water intake event.
Columns: id, user_id, amount_liters, logged_date, created_at.

### weight_logs
Historical weight entries for trend tracking.
Columns: id, user_id, weight_kg, logged_date, created_at.

### goals
Long-term objectives the user wants to track.
Columns: id, user_id, title, category, current_value, target_value, unit, deadline, color, created_at.

## Security
RLS enabled on every table. Four separate policies per table (SELECT / INSERT / UPDATE / DELETE)
scoped to `authenticated` users via `auth.uid() = user_id`.

## Notes
1. `profiles.id` is the same UUID as `auth.users.id` — no separate FK column needed.
2. All `user_id` columns default to `auth.uid()` so inserts from the frontend never need to pass it.
3. `logged_date` / `task_date` / `exercise_date` default to `current_date` (server clock in UTC).
*/

-- ───────────────────────────────────────────
-- PROFILES
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  goal_weight_kg numeric(5,1),
  health_goal text NOT NULL DEFAULT 'Manutenção',
  daily_calorie_goal int NOT NULL DEFAULT 2400,
  daily_water_goal_liters numeric(3,1) NOT NULL DEFAULT 2.5,
  activity_level text NOT NULL DEFAULT 'Moderadamente ativo',
  plan text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ───────────────────────────────────────────
-- MEALS
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  meal_type text NOT NULL DEFAULT 'snack',
  calories int NOT NULL DEFAULT 0,
  protein_g numeric(6,1) NOT NULL DEFAULT 0,
  carbs_g numeric(6,1) NOT NULL DEFAULT 0,
  fat_g numeric(6,1) NOT NULL DEFAULT 0,
  logged_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meals_user_date_idx ON meals(user_id, logged_date);

ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_meals" ON meals;
CREATE POLICY "select_own_meals" ON meals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_meals" ON meals;
CREATE POLICY "insert_own_meals" ON meals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_meals" ON meals;
CREATE POLICY "update_own_meals" ON meals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_meals" ON meals;
CREATE POLICY "delete_own_meals" ON meals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ───────────────────────────────────────────
-- DIARY TASKS
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diary_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  category text NOT NULL DEFAULT 'Geral',
  task_date date NOT NULL DEFAULT current_date,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS diary_tasks_user_date_idx ON diary_tasks(user_id, task_date);

ALTER TABLE diary_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tasks" ON diary_tasks;
CREATE POLICY "select_own_tasks" ON diary_tasks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tasks" ON diary_tasks;
CREATE POLICY "insert_own_tasks" ON diary_tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tasks" ON diary_tasks;
CREATE POLICY "update_own_tasks" ON diary_tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tasks" ON diary_tasks;
CREATE POLICY "delete_own_tasks" ON diary_tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ───────────────────────────────────────────
-- EXERCISES
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  sets text NOT NULL DEFAULT '3x12',
  weight_kg numeric(5,1),
  done boolean NOT NULL DEFAULT false,
  workout_type text NOT NULL DEFAULT 'Superior A',
  exercise_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exercises_user_date_idx ON exercises(user_id, exercise_date);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_exercises" ON exercises;
CREATE POLICY "select_own_exercises" ON exercises FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_exercises" ON exercises;
CREATE POLICY "insert_own_exercises" ON exercises FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_exercises" ON exercises;
CREATE POLICY "update_own_exercises" ON exercises FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_exercises" ON exercises;
CREATE POLICY "delete_own_exercises" ON exercises FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ───────────────────────────────────────────
-- WATER LOGS
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS water_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_liters numeric(4,2) NOT NULL DEFAULT 0.25,
  logged_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS water_logs_user_date_idx ON water_logs(user_id, logged_date);

ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_water" ON water_logs;
CREATE POLICY "select_own_water" ON water_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_water" ON water_logs;
CREATE POLICY "insert_own_water" ON water_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_water" ON water_logs;
CREATE POLICY "update_own_water" ON water_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_water" ON water_logs;
CREATE POLICY "delete_own_water" ON water_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ───────────────────────────────────────────
-- WEIGHT LOGS
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg numeric(5,1) NOT NULL,
  logged_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weight_logs_user_date_idx ON weight_logs(user_id, logged_date);

ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_weight" ON weight_logs;
CREATE POLICY "select_own_weight" ON weight_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_weight" ON weight_logs;
CREATE POLICY "insert_own_weight" ON weight_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_weight" ON weight_logs;
CREATE POLICY "update_own_weight" ON weight_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_weight" ON weight_logs;
CREATE POLICY "delete_own_weight" ON weight_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ───────────────────────────────────────────
-- GOALS
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Geral',
  current_value numeric(8,2) NOT NULL DEFAULT 0,
  target_value numeric(8,2) NOT NULL DEFAULT 100,
  unit text NOT NULL DEFAULT '',
  deadline date,
  color text NOT NULL DEFAULT 'bg-blue-500',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goals_user_idx ON goals(user_id);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_goals" ON goals;
CREATE POLICY "select_own_goals" ON goals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_goals" ON goals;
CREATE POLICY "insert_own_goals" ON goals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_goals" ON goals;
CREATE POLICY "update_own_goals" ON goals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_goals" ON goals;
CREATE POLICY "delete_own_goals" ON goals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
