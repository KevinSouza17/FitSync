/*
# Add barcode column to foods table

## Summary
Adds a nullable `barcode` text column to the `foods` table so that users can
search for foods by EAN/UPC barcode when logging custom foods. The column is
nullable because most reference foods don't have barcodes.

## Changes
1. ALTER TABLE foods ADD COLUMN barcode text (nullable, no default)
2. Index on barcode for fast lookups

## Security
No policy changes — foods table already has SELECT open to authenticated users.
*/
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'foods' AND column_name = 'barcode') THEN
    ALTER TABLE public.foods ADD COLUMN barcode text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS foods_barcode_idx ON public.foods (barcode) WHERE barcode IS NOT NULL;