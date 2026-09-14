/*
# Launch Security Hardening
1. Restricts sensitive columns (role, is_banned, verified, available_for_booking, plan, rating_avg, rating_count) from client writes
2. SECURITY DEFINER functions for safe profile creation, admin approval, account deletion
3. Professional accounts require admin approval before booking
4. professional_verification table for approval workflow
5. Drops email_exists to prevent enumeration
*/

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_city text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (
  full_name, avatar_url, bio, daily_calorie_goal, daily_water_goal_liters,
  height_cm, weight_kg, goal_weight_kg, health_goal, activity_level,
  is_private, location_city, is_professional,
  specialty, credentials, professional_role, registration_type, document_number,
  updated_at
) ON profiles TO authenticated;

CREATE OR REPLACE FUNCTION create_profile(
  p_full_name text,
  p_is_professional boolean DEFAULT false,
  p_professional_role text DEFAULT NULL,
  p_specialty text DEFAULT NULL,
  p_credentials text DEFAULT NULL,
  p_registration_type text DEFAULT 'autonomo',
  p_document_number text DEFAULT NULL,
  p_location_city text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (
    id, full_name, daily_calorie_goal, daily_water_goal_liters,
    is_professional, professional_role, specialty, credentials,
    registration_type, document_number, location_city,
    available_for_booking, verified, role, is_banned, plan
  ) VALUES (
    auth.uid(), p_full_name, 2400, 2.5,
    p_is_professional, p_professional_role, p_specialty, p_credentials,
    p_registration_type, p_document_number, p_location_city,
    false, false, 'user', false, 'free'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    is_professional = EXCLUDED.is_professional,
    professional_role = EXCLUDED.professional_role,
    specialty = EXCLUDED.specialty,
    credentials = EXCLUDED.credentials,
    registration_type = EXCLUDED.registration_type,
    document_number = EXCLUDED.document_number,
    location_city = EXCLUDED.location_city;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_profile FROM anon;
GRANT EXECUTE ON FUNCTION create_profile TO authenticated;

CREATE OR REPLACE FUNCTION approve_professional(p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE profiles SET verified = true, available_for_booking = true WHERE id = p_target;
END;
$$;

REVOKE EXECUTE ON FUNCTION approve_professional FROM anon;
GRANT EXECUTE ON FUNCTION approve_professional TO authenticated;

CREATE OR REPLACE FUNCTION delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM profiles WHERE id = auth.uid();
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_account FROM anon;
GRANT EXECUTE ON FUNCTION delete_account TO authenticated;

CREATE TABLE IF NOT EXISTS professional_verification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE professional_verification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_own_verification" ON professional_verification;
CREATE POLICY "insert_own_verification" ON professional_verification FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_verification" ON professional_verification;
CREATE POLICY "select_own_verification" ON professional_verification FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_all_verification_owner" ON professional_verification;
CREATE POLICY "select_all_verification_owner" ON professional_verification FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
  );

DROP POLICY IF EXISTS "update_verification_owner" ON professional_verification;
CREATE POLICY "update_verification_owner" ON professional_verification FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
  );

UPDATE profiles SET available_for_booking = false WHERE is_professional = true AND verified = false;

DROP FUNCTION IF EXISTS email_exists(text);
