/*
# Notifications system for invites and messages

## Summary
Adds an in-app notifications system so that invite codes and new-message alerts
are delivered inside the app (pop-up + Notifications tab) instead of relying on
email delivery, which was not arriving. The invitee sees a "convite" notification
with the 6-digit code and a Confirm button; new messages produce a "message"
notification. A background trigger inserts message notifications automatically.

## New Tables

### notifications
- id (uuid, pk)
- user_id (uuid, not null, defaults to auth.uid()) — recipient of the notification
- type (text, not null) — 'invite' | 'message' | 'system'
- title (text, not null)
- body (text) — longer description
- code (text) — the 6-digit invite code, for type = 'invite' only
- invite_email (text) — email entered by the inviter (the invitee's own email)
- inviter_id (uuid) — who sent the invite (null for message/system)
- inviter_name (text) — display name of the inviter (denormalized for the UI)
- conversation_id (uuid) — linked conversation, for type = 'message' or after an invite is accepted
- read (boolean, default false) — whether the user has seen/cleared it
- created_at (timestamptz, default now())

## New Functions (SECURITY DEFINER)
1. find_user_id_by_email(email text) → uuid
   Looks up auth.users by email and returns the id, or NULL. Used by the
   send-invite edge function (which runs with the service role) to resolve the
   invitee. Marked SECURITY DEFINER so it can read auth.users; the function only
   returns the id, nothing sensitive.
2. notify_new_message() → trigger
   Fires AFTER INSERT on messages. Inserts a 'message' notification for the
   recipient (the conversation participant who is NOT the sender), with the
   sender's profile name denormalized into inviter_name and the conversation_id
   set, so the notification can deep-link into the conversation.

## Security (RLS)
- notifications enabled for RLS.
- 4 separate policies (select/insert/update/delete), TO authenticated, scoped by
  auth.uid() = user_id. A user only ever sees and manages their own notifications.
- The message-notification trigger runs as SECURITY DEFINER (postgres) so it can
  insert into notifications bypassing RLS — but it only ever inserts a row whose
  user_id is the actual recipient, so it cannot be abused.

## Notes
1. Owner column user_id defaults to auth.uid() so client inserts (none currently,
   but future-proofed) satisfy the INSERT WITH CHECK.
2. Policies are idempotent (DROP IF EXISTS before CREATE).
3. The trigger only creates a notification for the recipient, never the sender.
4. Idempotent re-run: CREATE OR REPLACE for functions, DROP IF EXISTS for trigger.
*/
CREATE TABLE IF NOT EXISTS public.notifications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type            text        NOT NULL CHECK (type IN ('invite','message','system')),
  title           text        NOT NULL,
  body            text,
  code            text,
  invite_email    text,
  inviter_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  inviter_name    text,
  conversation_id uuid        REFERENCES public.conversations(id) ON DELETE CASCADE,
  read            boolean     NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications (user_id, read) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON public.notifications;
CREATE POLICY "select_own_notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON public.notifications;
CREATE POLICY "insert_own_notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON public.notifications;
CREATE POLICY "update_own_notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON public.notifications;
CREATE POLICY "delete_own_notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ── find_user_id_by_email ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
$$;

-- ── Message notification trigger ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_recipient uuid;
  v_sender_name text;
  v_conv_a uuid;
  v_conv_b uuid;
BEGIN
  SELECT user_a_id, user_b_id INTO v_conv_a, v_conv_b
    FROM public.conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_recipient := CASE WHEN NEW.sender_id = v_conv_a THEN v_conv_b ELSE v_conv_a END;

  SELECT full_name INTO v_sender_name
    FROM public.profiles WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, title, body, inviter_id, inviter_name, conversation_id, read)
  VALUES (
    v_recipient,
    'message',
    COALESCE(v_sender_name, 'Alguém') || ' te enviou uma mensagem',
    NEW.content,
    NEW.sender_id,
    v_sender_name,
    NEW.conversation_id,
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_inserted_notify ON public.messages;
CREATE TRIGGER on_message_inserted_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();