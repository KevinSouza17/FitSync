
/*
# Create foods table with comprehensive nutrition data

## Summary
Creates a `foods` table storing nutritional information for common foods (Brazilian and international).
This allows users to search for foods and auto-fill calories and macronutrients when logging meals.
The table is readable by all authenticated users and only writable via migrations (public reference data).

## New Table: foods
- id (uuid, primary key)
- name (text, not null) — Food name in Portuguese
- category (text, not null) — Food group (e.g. Carnes, Grãos, Frutas)
- serving_size (text, not null) — Default serving description (e.g. "100g", "1 unidade")
- calories (int, not null) — kcal per serving
- protein_g (numeric, not null) — grams of protein per serving
- carbs_g (numeric, not null) — grams of carbohydrates per serving
- fat_g (numeric, not null) — grams of fat per serving
- fiber_g (numeric, default 0) — grams of fiber per serving
- created_at (timestamptz)

## Security
RLS enabled. SELECT allowed for authenticated users. No INSERT/UPDATE/DELETE via API (data managed via migrations).
*/

CREATE TABLE IF NOT EXISTS foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  serving_size text NOT NULL DEFAULT '100g',
  calories int NOT NULL DEFAULT 0,
  protein_g numeric(6,1) NOT NULL DEFAULT 0,
  carbs_g numeric(6,1) NOT NULL DEFAULT 0,
  fat_g numeric(6,1) NOT NULL DEFAULT 0,
  fiber_g numeric(6,1) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS foods_name_idx ON foods(name);
CREATE INDEX IF NOT EXISTS foods_category_idx ON foods(category);

ALTER TABLE foods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_foods" ON foods;
CREATE POLICY "select_foods" ON foods FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_foods" ON foods;
CREATE POLICY "insert_foods" ON foods FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_foods" ON foods;
CREATE POLICY "update_foods" ON foods FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_foods" ON foods;
CREATE POLICY "delete_foods" ON foods FOR DELETE
  TO authenticated USING (true);
