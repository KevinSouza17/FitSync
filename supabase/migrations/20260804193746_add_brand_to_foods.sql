/*
# Add brand column to foods and custom_foods

1. Changes
- Add `brand` text column to `foods` table (nullable, defaults to null).
  - Used to store the brand/manufacturer of a catalog food item (e.g. "Nestlé", "Tyson").
- Add `brand` text column to `custom_foods` table (nullable, defaults to null).
  - Used when a user adds a product not in the catalog and wants to record its brand.
2. Security
- No RLS policy changes. Existing policies remain in effect.
3. Notes
- Both columns are nullable so existing rows are unaffected.
- Idempotent: uses DO $$ ... IF NOT EXISTS ... END $$ blocks.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'foods' AND column_name = 'brand') THEN
    ALTER TABLE foods ADD COLUMN brand text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_foods' AND column_name = 'brand') THEN
    ALTER TABLE custom_foods ADD COLUMN brand text;
  END IF;
END $$;
