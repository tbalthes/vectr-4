ALTER TABLE accounts
ADD COLUMN last_synced_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN accounts.last_synced_at IS 'Timestamp of the last successful data sync from the aggregator.';
