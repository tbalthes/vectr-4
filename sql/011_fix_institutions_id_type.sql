-- 011_fix_institutions_id_type.sql
-- Fix institutions table to allow Plaid institution IDs (text) instead of UUIDs
-- SAFE VERSION - Preserves existing data

BEGIN;

-- Step 1: Create a new institutions table with text IDs
CREATE TABLE public.institutions_new (
  id text PRIMARY KEY,
  provider text NOT NULL,
  name text NOT NULL,
  logo_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 2: Enable RLS on new table
ALTER TABLE public.institutions_new ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS policy for new table
CREATE POLICY "Allow authenticated users to manage institutions" ON public.institutions_new
  FOR ALL USING (auth.role() = 'authenticated');

-- Step 4: Add new column to accounts table for text institution IDs
ALTER TABLE public.accounts ADD COLUMN institution_id_new text;

-- Step 5: Drop the view temporarily
DROP VIEW IF EXISTS public.v_accounts_with_latest_balance;

-- Step 6: Update accounts to use NULL for institution_id_new (we'll populate this later when needed)
UPDATE public.accounts SET institution_id_new = NULL;

-- Step 7: Drop old foreign key constraint
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_institution_id_fkey;
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS fk_accounts_institution_id;

-- Step 8: Rename columns
ALTER TABLE public.accounts RENAME COLUMN institution_id TO institution_id_old;
ALTER TABLE public.accounts RENAME COLUMN institution_id_new TO institution_id;

-- Step 9: Rename tables
ALTER TABLE public.institutions RENAME TO institutions_old;
ALTER TABLE public.institutions_new RENAME TO institutions;

-- Step 10: Add foreign key constraint for new structure
ALTER TABLE public.accounts ADD CONSTRAINT accounts_institution_id_fkey 
  FOREIGN KEY (institution_id) REFERENCES public.institutions(id);

-- Step 11: Recreate the view
CREATE OR REPLACE VIEW public.v_accounts_with_latest_balance AS
SELECT 
  a.*,
  b.balance_amount,
  b.available,
  b.as_of
FROM public.accounts a
LEFT JOIN public.balances b ON a.id = b.account_id
WHERE b.as_of = (
  SELECT MAX(as_of) 
  FROM public.balances b2 
  WHERE b2.account_id = a.id
) OR b.as_of IS NULL;

-- Step 12: Add comment about cleanup
COMMENT ON TABLE public.institutions_old IS 'Old institutions table - can be dropped after verifying Plaid integration works. Contains original UUID-based data.';
COMMENT ON COLUMN public.accounts.institution_id_old IS 'Old institution_id column - can be dropped after verifying Plaid integration works.';

COMMIT;
