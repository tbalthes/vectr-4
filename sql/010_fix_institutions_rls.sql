-- 010_fix_institutions_rls.sql
-- Allow authenticated users to insert new institutions when connecting accounts

BEGIN;

-- Add INSERT policy for institutions table
-- Users need to create institutions when connecting new bank accounts via Plaid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'institutions' AND policyname = 'institutions_insert_auth'
  ) THEN
    CREATE POLICY institutions_insert_auth ON public.institutions
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

COMMIT;
