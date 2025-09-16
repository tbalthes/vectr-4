-- Add dedupe_key column to webhook_events for idempotency
-- Ensures duplicate webhooks from Plaid are not processed multiple times

BEGIN;

-- Add dedupe_key column to webhook_events table
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS dedupe_key text;

-- Create unique index on dedupe_key for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS ux_webhook_events_dedupe_key 
  ON public.webhook_events(dedupe_key) 
  WHERE dedupe_key IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.webhook_events.dedupe_key IS 'Deterministic key for webhook deduplication based on webhook content';

COMMIT;