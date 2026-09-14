/*
# Fix appointments RLS + professional-can-create appointments

## Summary
The previous appointments INSERT policy only allowed the CLIENT
(auth.uid() = user_id) to create a booking. When a professional tried
to schedule an appointment on behalf of a client, the insert was
silently rejected by RLS. This migration widens the INSERT and DELETE
policies so either the client or the professional involved in the
appointment can create and cancel it.

## Modified policies
### appointments
- insert_own_appointments: now allows either party (client or professional)
- delete_own_appointments: now allows either party (client or professional)

## Security
- No new tables.
- INSERT still requires the authenticated user to be one of the two
  participants (user_id or professional_id), so unrelated users cannot
  create appointments.
- DELETE still requires the authenticated user to be a participant.
*/

DROP POLICY IF EXISTS "insert_own_appointments" ON public.appointments;
CREATE POLICY "insert_own_appointments" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR auth.uid() = professional_id);

DROP POLICY IF EXISTS "delete_own_appointments" ON public.appointments;
CREATE POLICY "delete_own_appointments" ON public.appointments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = professional_id);
