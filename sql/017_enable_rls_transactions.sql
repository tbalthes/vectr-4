BEGIN;

-- Enable Row Level Security on transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies to avoid duplicates on re-run
DROP POLICY IF EXISTS "Users can select own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;

-- Allow authenticated users to select only their own transactions
CREATE POLICY "Users can select own transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow authenticated users to insert transactions only for themselves
CREATE POLICY "Users can insert own transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Allow authenticated users to update only their own transactions
CREATE POLICY "Users can update own transactions"
ON public.transactions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow authenticated users to delete only their own transactions
CREATE POLICY "Users can delete own transactions"
ON public.transactions
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Grant table privileges to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;

COMMIT;
