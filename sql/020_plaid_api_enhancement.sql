-- Enhance account_links table for Plaid integration
-- This adds missing columns needed for the Plaid API endpoints

-- Add missing columns to account_links table
ALTER TABLE public.account_links 
  ADD COLUMN IF NOT EXISTS institution_id text,
  ADD COLUMN IF NOT EXISTS institution_name text,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS unlinked_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_details jsonb,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Add missing columns to webhook_events table  
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS item_id text,
  ADD COLUMN IF NOT EXISTS webhook_type text,
  ADD COLUMN IF NOT EXISTS webhook_code text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

-- Add missing columns to accounts table for better Plaid support
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS account_link_id uuid REFERENCES public.account_links(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS aggregator_account_id text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS official_name text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS subtype text,
  ADD COLUMN IF NOT EXISTS mask text,
  ADD COLUMN IF NOT EXISTS balances jsonb;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_links_institution ON public.account_links(institution_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_item ON public.webhook_events(item_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type_code ON public.webhook_events(webhook_type, webhook_code);
CREATE INDEX IF NOT EXISTS idx_accounts_aggregator ON public.accounts(aggregator_account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_link ON public.accounts(account_link_id);

-- Add comments
COMMENT ON COLUMN public.account_links.institution_id IS 'Plaid institution ID';
COMMENT ON COLUMN public.account_links.institution_name IS 'Human-readable institution name';
COMMENT ON COLUMN public.account_links.linked_at IS 'When the account was first linked';
COMMENT ON COLUMN public.account_links.last_sync_at IS 'Last successful transaction sync';
COMMENT ON COLUMN public.account_links.unlinked_at IS 'When the account was unlinked';
COMMENT ON COLUMN public.account_links.error_details IS 'JSON details of any errors';
COMMENT ON COLUMN public.account_links.last_error_at IS 'When the last error occurred';
COMMENT ON COLUMN public.account_links.expires_at IS 'When the access token expires';

COMMENT ON COLUMN public.webhook_events.item_id IS 'Plaid item ID from webhook';
COMMENT ON COLUMN public.webhook_events.webhook_type IS 'Plaid webhook type (TRANSACTIONS, ITEM, etc.)';
COMMENT ON COLUMN public.webhook_events.webhook_code IS 'Plaid webhook code (DEFAULT_UPDATE, ERROR, etc.)';
COMMENT ON COLUMN public.webhook_events.status IS 'Processing status (received, processed, error)';
COMMENT ON COLUMN public.webhook_events.processed_at IS 'When the webhook was processed';

COMMENT ON COLUMN public.accounts.account_link_id IS 'Reference to the account link that created this account';
COMMENT ON COLUMN public.accounts.aggregator_account_id IS 'Plaid account ID';
COMMENT ON COLUMN public.accounts.provider IS 'Account provider (plaid, mx, etc.)';
COMMENT ON COLUMN public.accounts.official_name IS 'Official account name from provider';
COMMENT ON COLUMN public.accounts.type IS 'Account type (depository, credit, etc.)';
COMMENT ON COLUMN public.accounts.subtype IS 'Account subtype (checking, savings, etc.)';
COMMENT ON COLUMN public.accounts.mask IS 'Last 4 digits of account number';
COMMENT ON COLUMN public.accounts.balances IS 'Current account balances as JSON';
