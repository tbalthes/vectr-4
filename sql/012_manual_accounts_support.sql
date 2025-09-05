-- 012_manual_accounts_support.sql
-- Add support for manual institutions and accounts alongside Plaid

BEGIN;

-- 1) Extend institutions table with Plaid-like fields
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS country_codes text[],
  ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN public.institutions.url IS 'Institution website URL';
COMMENT ON COLUMN public.institutions.primary_color IS 'Institution brand primary color (hex)';
COMMENT ON COLUMN public.institutions.country_codes IS 'Array of country codes (e.g., [US, CA])';
COMMENT ON COLUMN public.institutions.metadata IS 'Additional provider-specific data (JSON)';

-- 2) Extend accounts table for better Plaid compatibility
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS subtype text,
  ADD COLUMN IF NOT EXISTS account_logo text;

-- Make plaid_access_token nullable for manual accounts
ALTER TABLE public.accounts 
  ALTER COLUMN plaid_access_token DROP NOT NULL;

COMMENT ON COLUMN public.accounts.subtype IS 'Account subtype (e.g., checking, savings, credit card)';
COMMENT ON COLUMN public.accounts.account_logo IS 'Account-specific logo URL (optional)';

-- 3) Update the accounts view to include new fields
DROP VIEW IF EXISTS public.v_accounts_with_latest_balance;

CREATE OR REPLACE VIEW public.v_accounts_with_latest_balance AS
SELECT
  a.id AS account_id,
  a.user_id,
  a.name,
  a.mask,
  a.type,
  a.subtype,
  a.currency,
  a.provider,
  a.aggregator_account_id,
  a.institution_id,
  a.account_logo,
  i.name AS institution_name,
  i.logo_url AS institution_logo_url,
  i.url AS institution_url,
  i.primary_color AS institution_primary_color,
  a.last_synced_at,
  lb.balance_amount,
  lb.available,
  lb.as_of AS balance_as_of
FROM public.accounts a
LEFT JOIN LATERAL (
  SELECT b.balance_amount, b.available, b.as_of
  FROM public.balances b
  WHERE b.account_id = a.id
  ORDER BY b.as_of DESC
  LIMIT 1
) lb ON TRUE
LEFT JOIN public.institutions i ON i.id = a.institution_id;

COMMENT ON VIEW public.v_accounts_with_latest_balance IS 'Enhanced accounts view with latest balance and full institution metadata for API consumption';

-- 4) Create indexes for performance
CREATE INDEX IF NOT EXISTS ix_institutions_provider_name 
ON public.institutions(provider, name);

CREATE INDEX IF NOT EXISTS ix_accounts_provider_type 
ON public.accounts(provider, type);

-- 5) Add validation constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_accounts_type' 
    AND conrelid = 'public.accounts'::regclass
  ) THEN
    ALTER TABLE public.accounts 
      ADD CONSTRAINT chk_accounts_type 
      CHECK (type IN ('depository', 'credit', 'loan', 'investment', 'other'));
  END IF;
END $$;

-- Note: We'll keep the existing provider constraint but ensure it includes 'manual'
-- The constraint should already allow 'manual' from the 005_aggregator_schema.sql

-- 6) Update RLS policies if needed (institutions table should already have read access for authenticated users)

COMMIT;
