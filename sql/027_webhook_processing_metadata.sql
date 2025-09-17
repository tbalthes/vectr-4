-- name: sql/027_webhook_processing_metadata.sql
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS processing_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_by text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;

-- Optional: partial index to find stale processing claims quickly
CREATE INDEX IF NOT EXISTS ix_webhook_events_processing_claimed
  ON public.webhook_events(processing_claimed_at)
  WHERE status = 'processing';
