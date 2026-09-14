/*
# Update create_profile function to accept handle parameter

## Changes
1. Drop the existing `create_profile(text,boolean,text,text,text,text,text,text)` function.
2. Recreate it with a new `p_handle text DEFAULT NULL` parameter.
3. The function now inserts the handle into the profiles table on signup.
4. Security: function remains SECURITY DEFINER, execute granted to authenticated only.
*/

DROP FUNCTION IF EXISTS create_profile(text, boolean, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION create_profile(
  p_full_name text,
  p_is_professional boolean DEFAULT false,
  p_professional_role text DEFAULT NULL,
  p_specialty text DEFAULT NULL,
  p_credentials text DEFAULT NULL,
  p_registration_type text DEFAULT 'autonomo',
  p_document_number text DEFAULT NULL,
  p_location_city text DEFAULT NULL,
  p_handle text DEFAULT NULL
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
    available_for_booking, verified, role, is_banned, plan, handle
  ) VALUES (
    auth.uid(), p_full_name, 2400, 2.5,
    p_is_professional, p_professional_role, p_specialty, p_credentials,
    p_registration_type, p_document_number, p_location_city,
    false, false, 'user', false, 'free', p_handle
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    is_professional = EXCLUDED.is_professional,
    professional_role = EXCLUDED.professional_role,
    specialty = EXCLUDED.specialty,
    credentials = EXCLUDED.credentials,
    registration_type = EXCLUDED.registration_type,
    document_number = EXCLUDED.document_number,
    location_city = EXCLUDED.location_city,
    handle = COALESCE(EXCLUDED.handle, profiles.handle);
END;
$$;

REVOKE EXECUTE ON FUNCTION create_profile FROM anon;
GRANT EXECUTE ON FUNCTION create_profile TO authenticated;
