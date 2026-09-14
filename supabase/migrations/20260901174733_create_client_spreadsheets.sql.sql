/*
# Create client_spreadsheets table

1. New Tables
- `client_spreadsheets` — stores Excel-style spreadsheets created by professionals for their clients.
  - `id` (uuid, primary key)
  - `professional_id` (uuid, references profiles.id) — the professional who created the sheet
  - `client_id` (uuid, references profiles.id) — the client the sheet belongs to
  - `title` (text, not null) — spreadsheet title
  - `sheet_type` (text, not null) — "diet" or "workout"
  - `data` (jsonb, not null) — grid data: array of rows, each row is array of cell objects {v: string}
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Security
- Enable RLS on `client_spreadsheets`.
- Professional (owner) has full CRUD on sheets they created.
- Clients can read (view-only) sheets assigned to them.
*/

CREATE TABLE IF NOT EXISTS public.client_spreadsheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  sheet_type text NOT NULL DEFAULT 'diet' CHECK (sheet_type IN ('diet', 'workout')),
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_spreadsheets ENABLE ROW LEVEL SECURITY;

-- Professional can read sheets they created
DROP POLICY IF EXISTS "select_own_spreadsheets" ON public.client_spreadsheets;
CREATE POLICY "select_own_spreadsheets"
  ON public.client_spreadsheets FOR SELECT
  TO authenticated
  USING (auth.uid() = professional_id OR auth.uid() = client_id);

-- Professional can insert sheets for their clients
DROP POLICY IF EXISTS "insert_own_spreadsheets" ON public.client_spreadsheets;
CREATE POLICY "insert_own_spreadsheets"
  ON public.client_spreadsheets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = professional_id);

-- Professional can update sheets they created
DROP POLICY IF EXISTS "update_own_spreadsheets" ON public.client_spreadsheets;
CREATE POLICY "update_own_spreadsheets"
  ON public.client_spreadsheets FOR UPDATE
  TO authenticated
  USING (auth.uid() = professional_id)
  WITH CHECK (auth.uid() = professional_id);

-- Professional can delete sheets they created
DROP POLICY IF EXISTS "delete_own_spreadsheets" ON public.client_spreadsheets;
CREATE POLICY "delete_own_spreadsheets"
  ON public.client_spreadsheets FOR DELETE
  TO authenticated
  USING (auth.uid() = professional_id);

CREATE INDEX IF NOT EXISTS idx_client_spreadsheets_pro ON public.client_spreadsheets(professional_id);
CREATE INDEX IF NOT EXISTS idx_client_spreadsheets_client ON public.client_spreadsheets(client_id);
