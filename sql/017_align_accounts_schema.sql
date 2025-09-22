-- Migration to align the 'accounts' table with the application's data model.

-- Add the 'provider' column to identify the data source
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'manual';
COMMENT ON COLUMN public.accounts.provider IS 'The data provider for this account, e.g., ''plaid'', ''manual''.';

-- Add 'plaid_access_token' to store the item-specific token
-- WARNING: This should be encrypted in a production environment.
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS plaid_access_token TEXT;
COMMENT ON COLUMN public.accounts.plaid_access_token IS 'Encrypted Plaid access token. WARNING: Encrypt before storing in production.';

-- Add 'last_synced_at' to track data freshness
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
COMMENT ON COLUMN public.accounts.last_synced_at IS 'Timestamp of the last successful data sync from the aggregator.';


-- Drop dependent view before dropping columns
DROP VIEW IF EXISTS public.v_accounts_with_latest_balance;
ALTER TABLE public.accounts DROP COLUMN IF EXISTS current_balance;
ALTER TABLE public.accounts DROP COLUMN IF EXISTS available_balance;

-- TODO: Recreate v_accounts_with_latest_balance to use the balances table instead of accounts.current_balance

-- Add a 'status' column for better state management if it doesn't exist
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
COMMENT ON COLUMN public.accounts.status IS 'The status of the account, e.g., ''active'', ''inactive'', ''needs_relink''.';

-- Ensure the updated_at trigger is in place
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_accounts_updated_at' AND tgrelid = 'public.accounts'::regclass
  ) THEN
    CREATE TRIGGER set_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END;
$$;
