/*
# Create conversations and messages tables

## Summary
Adds a simple direct-messaging system so users and professionals can chat with
each other inside the app, matching the "Mensagens" screen from the design.
A conversation is a 1-to-1 channel between any two authenticated users (typically
a patient and a professional). Messages belong to a conversation and are ordered
by creation time.

## New Tables

### conversations
- `id` (uuid, primary key)
- `user_a_id` (uuid, not null) — first participant (defaults to the authenticated user)
- `user_b_id` (uuid, not null) — second participant
- `last_message_at` (timestamptz) — updated whenever a new message is sent, used to sort the conversation list
- `created_at` (timestamptz)

A CHECK constraint ensures user_a_id and user_b_id are always different, and a
unique index on the unordered pair prevents duplicate conversations between the
same two people (regardless of who is A or B).

### messages
- `id` (uuid, primary key)
- `conversation_id` (uuid, foreign key to conversations, cascade delete)
- `sender_id` (uuid, not null, defaults to the authenticated user)
- `content` (text, not null)
- `read` (boolean, default false) — whether the recipient has seen it
- `created_at` (timestamptz)

## Security (RLS)
Both tables are enabled for Row Level Security. Access is scoped so a user can
only see conversations they are a participant in, and only messages within those
conversations. Standard 4-policy CRUD (select/insert/update/delete) per table,
`TO authenticated`, using `auth.uid()` ownership checks.

## Notes
1. Owner columns default to `auth.uid()` so client inserts that omit the owner
   still satisfy the INSERT WITH CHECK predicate.
2. A trigger `touch_conversation_on_insert` updates `conversations.last_message_at`
   whenever a message is inserted, so the conversation list stays sorted by the
   most recent message without client-side logic.
3. Policies are idempotent (DROP IF EXISTS before CREATE).
*/

-- ── conversations ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id     uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now(),
  CHECK (user_a_id <> user_b_id)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Unordered unique index: prevents duplicate conversations between the same two users
CREATE UNIQUE INDEX IF NOT EXISTS conversations_pair_unique
  ON public.conversations (LEAST(user_a_id, user_b_id), GREATEST(user_a_id, user_b_id));

CREATE INDEX IF NOT EXISTS conversations_user_a_idx ON public.conversations (user_a_id);
CREATE INDEX IF NOT EXISTS conversations_user_b_idx ON public.conversations (user_b_id);

DROP POLICY IF EXISTS "select_own_conversations" ON public.conversations;
CREATE POLICY "select_own_conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "insert_own_conversations" ON public.conversations;
CREATE POLICY "insert_own_conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "update_own_conversations" ON public.conversations;
CREATE POLICY "update_own_conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id)
  WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "delete_own_conversations" ON public.conversations;
CREATE POLICY "delete_own_conversations"
  ON public.conversations FOR DELETE TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- ── messages ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content         text        NOT NULL,
  read            boolean     NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages (conversation_id, created_at);

DROP POLICY IF EXISTS "select_own_messages" ON public.messages;
CREATE POLICY "select_own_messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "insert_own_messages" ON public.messages;
CREATE POLICY "insert_own_messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "update_own_messages" ON public.messages;
CREATE POLICY "update_own_messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "delete_own_messages" ON public.messages;
CREATE POLICY "delete_own_messages"
  ON public.messages FOR DELETE TO authenticated
  USING (
    sender_id = auth.uid()
  );

-- ── Trigger: touch conversation on new message ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_inserted ON public.messages;
CREATE TRIGGER on_message_inserted
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_conversation();
