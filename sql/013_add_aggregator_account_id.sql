ALTER TABLE accounts
ADD COLUMN aggregator_account_id TEXT;

CREATE INDEX IF NOT EXISTS idx_accounts_aggregator_account_id ON accounts(aggregator_account_id);
