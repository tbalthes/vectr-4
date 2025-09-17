-- name: sql/0XX_webhook_events_idempotency.sql
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS webhook_type text,
  ADD COLUMN IF NOT EXISTS webhook_code text,
  ADD COLUMN IF NOT EXISTS item_id text,
  ADD COLUMN IF NOT EXISTS payload_json jsonb,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'received' CHECK (status IN ('received','processed','error')),
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

-- Make the JSON column type safe
ALTER TABLE public.webhook_events
  ALTER COLUMN payload_json SET DATA TYPE jsonb USING payload_json::jsonb;

-- Create unique index on dedupe_key for strong dedupe guarantees
CREATE UNIQUE INDEX IF NOT EXISTS ux_webhook_events_dedupe_key
  ON public.webhook_events(dedupe_key);

-- Optional: index to speed pre-checks
CREATE INDEX IF NOT EXISTS ix_webhook_events_dedupe_status
  ON public.webhook_events(dedupe_key, status);