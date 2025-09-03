-- 008_balances_table.sql
-- Create balances table with RLS and indexes

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  balance_amount numeric(14,2) NOT NULL,
  available numeric(14,2),
  as_of timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.balances IS 'Point-in-time balances for accounts.';

-- Helpful indexes
CREATE INDEX IF NOT EXISTS ix_balances_account_asof ON public.balances(account_id, as_of DESC);

-- Enable RLS and create policy scoped to owner via accounts.user_id
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'balances' AND policyname = 'balances_user_isolation_select'
  ) THEN
    CREATE POLICY balances_user_isolation_select ON public.balances
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.accounts a
          WHERE a.id = balances.account_id AND a.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'balances' AND policyname = 'balances_user_isolation_insert'
  ) THEN
    CREATE POLICY balances_user_isolation_insert ON public.balances
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.accounts a
          WHERE a.id = account_id AND a.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'balances' AND policyname = 'balances_user_isolation_update'
  ) THEN
    CREATE POLICY balances_user_isolation_update ON public.balances
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.accounts a
          WHERE a.id = balances.account_id AND a.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.accounts a
          WHERE a.id = balances.account_id AND a.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'balances' AND policyname = 'balances_user_isolation_delete'
  ) THEN
    CREATE POLICY balances_user_isolation_delete ON public.balances
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.accounts a
          WHERE a.id = balances.account_id AND a.user_id = auth.uid()
        )
      );
  END IF;
END $$;

COMMIT;
