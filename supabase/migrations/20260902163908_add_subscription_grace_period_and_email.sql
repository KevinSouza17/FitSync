/*
# Add subscription grace period tracking and email notification log

## Purpose
Track when a professional subscription expires and enforce a 5-day grace period
before locking professional features. Also logs email notifications sent to users.

## Changes to `subscriptions` table
- `past_due_since` (timestamptz, nullable): set when subscription enters `past_due`
  or `unpaid` status. Cleared when payment succeeds.
- `locked_at` (timestamptz, nullable): set when the grace period expires (5 days
  after `past_due_since`). When set, professional features are disabled.

## New table: `notification_emails`
- Logs payment-related emails sent to users so we don't spam duplicates.
- `id` (uuid PK)
- `user_id` (uuid FK to auth.users)
- `email_type` (text): e.g. "payment_overdue", "subscription_canceled", "trial_ending"
- `sent_at` (timestamptz, default now())

## Security
- RLS enabled on `notification_emails`.
- Users can read their own notification logs only.
- Inserts allowed for authenticated (the edge function uses service role key, bypassing RLS).

## Helper functions
- `is_pro_locked(p_user)`: returns true if professional features should be locked.
- `lock_expired_subscriptions()`: batch-locks all expired subscriptions past grace period.
*/

-- Add grace period columns to subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS past_due_since timestamptz,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

-- Notification email log table
CREATE TABLE IF NOT EXISTS notification_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notification_emails" ON notification_emails;
CREATE POLICY "select_own_notification_emails" ON notification_emails FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notification_emails" ON notification_emails;
CREATE POLICY "insert_own_notification_emails" ON notification_emails FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Index for dedup queries
CREATE INDEX IF NOT EXISTS idx_notification_emails_user_type ON notification_emails(user_id, email_type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_past_due ON subscriptions(past_due_since) WHERE past_due_since IS NOT NULL;

-- Helper function: check if a user's professional features should be locked
-- Returns true if subscription is past_due/unpaid/canceled AND grace period (5 days) has elapsed
CREATE OR REPLACE FUNCTION is_pro_locked(p_user uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = p_user
      AND (
        locked_at IS NOT NULL
        OR (
          status IN ('past_due', 'unpaid', 'canceled')
          AND past_due_since IS NOT NULL
          AND past_due_since < now() - interval '5 days'
        )
        OR (
          status IN ('canceled', 'incomplete', 'incomplete_expired')
          AND current_period_end IS NOT NULL
          AND current_period_end < now() - interval '5 days'
        )
      )
  );
$$;

-- Helper function: lock expired subscriptions (called by webhook or cron)
CREATE OR REPLACE FUNCTION lock_expired_subscriptions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE subscriptions
  SET locked_at = now(),
      updated_at = now()
  WHERE locked_at IS NULL
    AND (
      (status IN ('past_due', 'unpaid', 'canceled')
       AND past_due_since IS NOT NULL
       AND past_due_since < now() - interval '5 days')
      OR
      (status IN ('canceled', 'incomplete', 'incomplete_expired')
       AND current_period_end IS NOT NULL
       AND current_period_end < now() - interval '5 days')
    );
$$;
