
/*
# Add professional account fields to profiles

## Summary
Adds professional account support to the `profiles` table, allowing users to register as health/fitness professionals (nutritionists, personal trainers, doctors, etc.) with specialty, credentials, bio, and contact info.

## New Columns on profiles
- is_professional (boolean, default false) — Whether the user is a professional
- professional_role (text) — Role title (e.g. "Nutricionista", "Personal Trainer")
- specialty (text) — Specialty area (e.g. "Nutrição Esportiva")
- bio (text) — Professional bio/description
- credentials (text) — License/credential number (e.g. CRN, CREF)
- location_city (text) — City for scheduling
- available_for_booking (boolean, default false) — Whether accepting appointments
- rating_avg (numeric, default 0) — Average rating
- rating_count (int, default 0) — Number of ratings
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_professional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS professional_role text,
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS credentials text,
  ADD COLUMN IF NOT EXISTS location_city text,
  ADD COLUMN IF NOT EXISTS available_for_booking boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count int NOT NULL DEFAULT 0;
