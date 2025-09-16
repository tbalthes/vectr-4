-- Add extended webhook_events columns for Plaid webhooks
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS item_id text,
  ADD COLUMN IF NOT EXISTS webhook_type text,
  ADD COLUMN IF NOT EXISTS webhook_code text,
  ADD COLUMN IF NOT EXISTS dedupe_key text;

-- Optional: store raw payload as jsonb in payload_json (rename/migrate if needed)
ALTER TABLE public.webhook_events
  ALTER COLUMN payload_json SET DATA TYPE jsonb USING payload_json::jsonb;

-- Unique index to prevent duplicate processing from identical dedupe_keys
CREATE UNIQUE INDEX IF NOT EXISTS ux_webhook_events_dedupe_key ON public.webhook_events(dedupe_key);