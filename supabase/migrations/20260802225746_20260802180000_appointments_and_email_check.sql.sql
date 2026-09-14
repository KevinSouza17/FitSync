/*
# Appointments system + email check function

## Summary
Creates an appointments table for booking sessions with professionals, and a
SECURITY DEFINER function to check if an email is already registered (for the
signup email-exists check).

## New Tables

### appointments
- id (uuid, pk)
- user_id (uuid, not null, defaults auth.uid()) — the client booking the session
- professional_id (uuid, not null) — the professional being booked
- appointment_date (date, not null) — requested date
- appointment_time (time, not null) — requested time slot
- duration_minutes (int, default 60)
- status (text, default 'pending') — pending, confirmed, completed, cancelled
- notes (text) — client notes about the appointment
- created_at (timestamptz)

## New Functions

### email_exists(email text)
SECURITY DEFINER function that checks if an email exists in auth.users.
Returns boolean. Used by the Register page to check if an email is already
registered BEFORE attempting signup.

## Security
- appointments table has RLS enabled.
- Clients can see their own bookings (auth.uid() = user_id).
- Professionals can see bookings where they are the professional (auth.uid() = professional_id).
- Only the client can insert their own booking.
- Clients can update/cancel their own bookings.
- Professionals can update bookings assigned to them (to confirm/cancel).
- email_exists function is SECURITY DEFINER, callable by authenticated and anon.
*/
CREATE TABLE IF NOT EXISTS public.appointments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  professional_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_date  date NOT NULL,
  appointment_time  time NOT NULL,
  duration_minutes  int  NOT NULL DEFAULT 60,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointments_user_idx ON public.appointments (user_id, appointment_date DESC);
CREATE INDEX IF NOT EXISTS appointments_pro_idx ON public.appointments (professional_id, appointment_date DESC);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_appointments" ON public.appointments;
CREATE POLICY "select_own_appointments" ON public.appointments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = professional_id);

DROP POLICY IF EXISTS "insert_own_appointments" ON public.appointments;
CREATE POLICY "insert_own_appointments" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_appointments" ON public.appointments;
CREATE POLICY "update_own_appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = professional_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = professional_id);

DROP POLICY IF EXISTS "delete_own_appointments" ON public.appointments;
CREATE POLICY "delete_own_appointments" ON public.appointments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.email_exists(check_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = check_email);
$$;

GRANT EXECUTE ON FUNCTION public.email_exists(text) TO anon, authenticated;