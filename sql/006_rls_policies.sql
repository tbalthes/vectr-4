-- 006_rls_policies.sql
-- Tighten/ensure RLS policies for user-owned tables used by Accounts page

BEGIN;

-- Enable RLS if not already enabled
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Accounts: each user can access only their rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'accounts_user_isolation_select'
  ) THEN
    CREATE POLICY accounts_user_isolation_select ON public.accounts
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'accounts_user_isolation_insert'
  ) THEN
    CREATE POLICY accounts_user_isolation_insert ON public.accounts
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'accounts_user_isolation_update'
  ) THEN
    CREATE POLICY accounts_user_isolation_update ON public.accounts
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'accounts_user_isolation_delete'
  ) THEN
    CREATE POLICY accounts_user_isolation_delete ON public.accounts
      FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Transactions: similar user isolation guards (if not defined elsewhere)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'transactions_user_isolation_select'
  ) THEN
    CREATE POLICY transactions_user_isolation_select ON public.transactions
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'transactions_user_isolation_insert'
  ) THEN
    CREATE POLICY transactions_user_isolation_insert ON public.transactions
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'transactions_user_isolation_update'
  ) THEN
    CREATE POLICY transactions_user_isolation_update ON public.transactions
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'transactions_user_isolation_delete'
  ) THEN
    CREATE POLICY transactions_user_isolation_delete ON public.transactions
      FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

COMMIT;
