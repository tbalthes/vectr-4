-- Webhook deduplication and per-item sync locks
-- Safe to run multiple times (use IF NOT EXISTS)

-- 1) Raw event log (already referenced by code, ensure it exists)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE,
  provider text NOT NULL,
  event_type text,
  webhook_code text,
  item_id text,
  payload jsonb,
  processed boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Dedup table keyed by stable hash of raw body
CREATE TABLE IF NOT EXISTS public.webhook_event_dedup (
  body_sha256 text PRIMARY KEY,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  seen_count integer NOT NULL DEFAULT 1
);

-- Update last_seen/seen_count on conflict to count repeats
CREATE OR REPLACE FUNCTION public.upsert_webhook_dedup(p_body_sha256 text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.webhook_event_dedup (body_sha256)
  VALUES (p_body_sha256)
  ON CONFLICT (body_sha256)
  DO UPDATE SET last_seen_at = now(), seen_count = public.webhook_event_dedup.seen_count + 1;
END;$$;

-- 3) Per-item lock table implementing a coarse debounce
CREATE TABLE IF NOT EXISTS public.item_sync_locks (
  item_id text PRIMARY KEY,
  locked_until timestamptz NOT NULL
);

-- Try to acquire a lock for an item for the next N seconds
-- Returns true if acquired (caller should proceed), false if another worker holds it
CREATE OR REPLACE FUNCTION public.try_acquire_item_lock(p_item_id text, p_ttl_seconds int)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  now_ts timestamptz := now();
  new_until timestamptz := now_ts + make_interval(secs => p_ttl_seconds);
  v_rowcount integer;
BEGIN
  -- Upsert pattern: if missing, insert; if existing but expired, take over; else refuse
  LOOP
    BEGIN
      INSERT INTO public.item_sync_locks (item_id, locked_until)
      VALUES (p_item_id, new_until)
      ON CONFLICT (item_id)
      DO UPDATE SET locked_until = EXCLUDED.locked_until
      WHERE public.item_sync_locks.locked_until <= now_ts;

      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      RETURN v_rowcount > 0; -- true if inserted or updated (i.e., lock acquired)
    EXCEPTION WHEN deadlock_detected OR serialization_failure THEN
      -- retry
    END;
  END LOOP;
END;$$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_item_id ON public.webhook_events(item_id);
CREATE INDEX IF NOT EXISTS idx_webhook_event_dedup_last_seen ON public.webhook_event_dedup(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_item_sync_locks_locked_until ON public.item_sync_locks(locked_until);
-- Speed up latest balance lookups if not already present
CREATE INDEX IF NOT EXISTS idx_balances_account_asof_created ON public.balances(account_id, as_of DESC, created_at DESC);
-- Speed up account_link lookups by item and status
CREATE INDEX IF NOT EXISTS idx_account_links_item_status ON public.account_links(item_id, status);
