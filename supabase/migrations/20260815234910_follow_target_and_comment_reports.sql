/* Keep the community connected to the official FitSync account and support comment reports. */

CREATE TABLE IF NOT EXISTS public.comment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.feed_comments(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, reporter_id)
);

ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_reports_select_own_or_owner" ON public.comment_reports;
CREATE POLICY "comment_reports_select_own_or_owner" ON public.comment_reports FOR SELECT
  TO authenticated USING (reporter_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'));
DROP POLICY IF EXISTS "comment_reports_insert_own" ON public.comment_reports;
CREATE POLICY "comment_reports_insert_own" ON public.comment_reports FOR INSERT
  TO authenticated WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS "comment_reports_update_owner" ON public.comment_reports;
CREATE POLICY "comment_reports_update_owner" ON public.comment_reports FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'));
DROP POLICY IF EXISTS "comment_reports_delete_own_or_owner" ON public.comment_reports;
CREATE POLICY "comment_reports_delete_own_or_owner" ON public.comment_reports FOR DELETE
  TO authenticated USING (reporter_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'));

CREATE OR REPLACE FUNCTION public.follow_official_account_on_profile_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  official_id uuid;
BEGIN
  SELECT id INTO official_id FROM auth.users WHERE lower(email) = lower('kevinsouzag42@gmail.com') LIMIT 1;
  IF official_id IS NOT NULL AND official_id <> NEW.id THEN
    INSERT INTO public.follows (follower_id, followee_id, status)
    VALUES (NEW.id, official_id, 'accepted')
    ON CONFLICT (follower_id, followee_id) DO UPDATE SET status = 'accepted';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS follow_official_account_after_profile_created ON public.profiles;
CREATE TRIGGER follow_official_account_after_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.follow_official_account_on_profile_created();

DO $$
DECLARE official_id uuid;
BEGIN
  SELECT id INTO official_id FROM auth.users WHERE lower(email) = lower('kevinsouzag42@gmail.com') LIMIT 1;
  IF official_id IS NOT NULL THEN
    INSERT INTO public.follows (follower_id, followee_id, status)
    SELECT p.id, official_id, 'accepted'
    FROM public.profiles p
    WHERE p.id <> official_id
    ON CONFLICT (follower_id, followee_id) DO UPDATE SET status = 'accepted';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.follow_official_account_on_profile_created() FROM PUBLIC;
