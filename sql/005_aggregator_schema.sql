-- 005_aggregator_schema.sql
-- Aggregator readiness: institutions, account_links, webhook_events
-- + accounts/transactions columns, indexes, and RLS scaffolding

BEGIN;

-- Ensure pgcrypto for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Institutions table
CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('plaid','mx','manual')),
  name text NOT NULL,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.institutions IS 'Financial institutions / providers for linked accounts.';

-- 2) Account links table (stores secure provider access, server-only access)
CREATE TABLE IF NOT EXISTS public.account_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('plaid','mx')),
  item_id text NOT NULL,
  access_token_encrypted text NOT NULL, -- store only encrypted tokens
  cursor text, -- provider sync cursor (e.g., Plaid transactions cursor)
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','error')),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.account_links IS 'Per-user aggregator link records. Tokens stored encrypted. Client should never read.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_account_links_item ON public.account_links(item_id);
CREATE INDEX IF NOT EXISTS ix_account_links_user ON public.account_links(user_id);

-- 3) Webhook events (ingestion + idempotency)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('plaid','mx')),
  event_type text NOT NULL,
  payload_json jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','error')),
  error text
);

COMMENT ON TABLE public.webhook_events IS 'Raw webhook payloads for audit/idempotency.';
CREATE INDEX IF NOT EXISTS ix_webhook_events_provider_type ON public.webhook_events(provider, event_type);
CREATE INDEX IF NOT EXISTS ix_webhook_events_received_at ON public.webhook_events(received_at DESC);

-- 4) Accounts table augmentations
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS provider text CHECK (provider IN ('plaid','mx','manual')),
  ADD COLUMN IF NOT EXISTS aggregator_account_id text,
  ADD COLUMN IF NOT EXISTS institution_id uuid,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- FK: accounts.institution_id -> institutions.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_accounts_institution_id' AND conrelid = 'public.accounts'::regclass
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT fk_accounts_institution_id FOREIGN KEY (institution_id)
      REFERENCES public.institutions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Unique index per user for aggregator_account_id (nullable-safe)
CREATE UNIQUE INDEX IF NOT EXISTS ux_accounts_user_aggacct
ON public.accounts(user_id, aggregator_account_id)
WHERE aggregator_account_id IS NOT NULL;

-- 5) Transactions table augmentations
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS aggregator_transaction_id text;

-- Unique per user on aggregator_transaction_id (nullable-safe)
CREATE UNIQUE INDEX IF NOT EXISTS ux_tx_user_aggid
ON public.transactions(user_id, aggregator_transaction_id)
WHERE aggregator_transaction_id IS NOT NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS ix_accounts_user_provider ON public.accounts(user_id, provider);
CREATE INDEX IF NOT EXISTS ix_transactions_user_date ON public.transactions(user_id, date DESC);

-- 6) Updated-at trigger for account_links
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_account_links_updated_at ON public.account_links;
CREATE TRIGGER trg_account_links_updated_at
BEFORE UPDATE ON public.account_links
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7) RLS scaffolding
-- Institutions: allow read for authenticated users (non-sensitive metadata)
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'institutions' AND policyname = 'institutions_read_all_auth'
  ) THEN
    CREATE POLICY institutions_read_all_auth ON public.institutions
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- account_links: server-only; enable RLS, but DO NOT create client policies
ALTER TABLE public.account_links ENABLE ROW LEVEL SECURITY;

-- webhook_events: server-only; enable RLS, but DO NOT create client policies
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

COMMIT;
