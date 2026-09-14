/*
# Professional registration types + client plans

## Summary
Adds professional registration type (autonomous vs company), document number
(CNPJ for companies, CREF/CRN/CRM for autonomous professionals), and a
verification flag to profiles. Also creates a client_plans table so
professionals can assign diet and workout plans to their clients.

## Modified Tables

### profiles
- registration_type (text, default 'autonomo') — 'autonomo' or 'empresa'
- document_number (text, nullable) — CNPJ for companies, CREF/CRN/CRM/etc for autonomous
- verified (boolean, default false) — whether the professional's registration has been verified

## New Tables

### client_plans
- id (uuid, pk)
- professional_id (uuid, not null, defaults auth.uid()) — the professional creating the plan
- client_id (uuid, not null) — the client receiving the plan
- plan_type (text, not null) — 'diet' or 'workout'
- title (text, not null)
- description (text, nullable)
- target_calories (integer, nullable) — daily calorie target for diet plans
- target_protein_g (numeric, nullable)
- target_carbs_g (numeric, nullable)
- target_fat_g (numeric, nullable)
- content (jsonb, nullable) — structured plan data (meals array or workout days)
- active (boolean, default true)
- created_at (timestamptz)
- updated_at (timestamptz)

## Security
- client_plans has RLS enabled.
- Professionals can CRUD plans they created (auth.uid() = professional_id).
- Clients can SELECT plans assigned to them (auth.uid() = client_id).
- No other access.
*/
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS registration_type text NOT NULL DEFAULT 'autonomo' CHECK (registration_type IN ('autonomo', 'empresa')),
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.client_plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id   uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type         text NOT NULL CHECK (plan_type IN ('diet', 'workout')),
  title             text NOT NULL,
  description       text,
  target_calories   integer,
  target_protein_g  numeric,
  target_carbs_g    numeric,
  target_fat_g      numeric,
  content           jsonb,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_plans_pro_idx ON public.client_plans (professional_id, created_at DESC);
CREATE INDEX IF NOT EXISTS client_plans_client_idx ON public.client_plans (client_id, active DESC);

ALTER TABLE public.client_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_client_plans" ON public.client_plans;
CREATE POLICY "select_own_client_plans" ON public.client_plans FOR SELECT TO authenticated
  USING (auth.uid() = professional_id OR auth.uid() = client_id);

DROP POLICY IF EXISTS "insert_own_client_plans" ON public.client_plans;
CREATE POLICY "insert_own_client_plans" ON public.client_plans FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = professional_id);

DROP POLICY IF EXISTS "update_own_client_plans" ON public.client_plans;
CREATE POLICY "update_own_client_plans" ON public.client_plans FOR UPDATE TO authenticated
  USING (auth.uid() = professional_id)
  WITH CHECK (auth.uid() = professional_id);

DROP POLICY IF EXISTS "delete_own_client_plans" ON public.client_plans;
CREATE POLICY "delete_own_client_plans" ON public.client_plans FOR DELETE TO authenticated
  USING (auth.uid() = professional_id);