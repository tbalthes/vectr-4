-- Comprehensive migration to update the 'accounts' table with all required columns for Plaid integration.

-- Add provider to identify the data source (e.g., 'plaid', 'manual')
ALTER TABLE accounts ADD COLUMN provider TEXT NOT NULL DEFAULT 'manual';
COMMENT ON COLUMN accounts.provider IS 'The data provider for this account, e.g., ''plaid'', ''manual''.';

-- Add aggregator_account_id to store the Plaid-specific account ID
ALTER TABLE accounts ADD COLUMN aggregator_account_id TEXT;
CREATE INDEX IF NOT EXISTS idx_accounts_aggregator_account_id ON accounts(aggregator_account_id);
COMMENT ON COLUMN accounts.aggregator_account_id IS 'The unique account ID from the data aggregator (e.g., Plaid).';

-- Add institution_id to link to the institutions table
ALTER TABLE accounts ADD COLUMN institution_id TEXT;
-- Assuming you have an institutions table with a primary key `institution_id` of type TEXT
-- ALTER TABLE accounts ADD CONSTRAINT fk_institution FOREIGN KEY (institution_id) REFERENCES institutions(institution_id);
CREATE INDEX IF NOT EXISTS idx_accounts_institution_id ON accounts(institution_id);
COMMENT ON COLUMN accounts.institution_id IS 'Foreign key linking to the financial institution.';

-- Add account_link_id to link to the account_links table
-- This assumes you have an `account_links` table with a UUID primary key named `id`.
ALTER TABLE accounts ADD COLUMN account_link_id UUID;
-- ALTER TABLE accounts ADD CONSTRAINT fk_account_link FOREIGN KEY (account_link_id) REFERENCES account_links(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_account_link_id ON accounts(account_link_id);
COMMENT ON COLUMN accounts.account_link_id IS 'Foreign key linking to the account_links table for item-level information.';

-- Add plaid_access_token to store the access token
-- WARNING: Storing sensitive data like access tokens in plaintext is a security risk.
-- This should be encrypted in a production environment.
ALTER TABLE accounts ADD COLUMN plaid_access_token TEXT;
COMMENT ON COLUMN accounts.plaid_access_token IS 'Encrypted Plaid access token. WARNING: Encrypt before storing in production.';

-- Add last_synced_at to track data freshness
ALTER TABLE accounts ADD COLUMN last_synced_at TIMESTAMPTZ;
COMMENT ON COLUMN accounts.last_synced_at IS 'Timestamp of the last successful data sync from the aggregator.';

-- Add a status field for better state management
ALTER TABLE accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
COMMENT ON COLUMN accounts.status IS 'The status of the account, e.g., ''active'', ''inactive'', ''needs_relink''.';

-- Add a created_at field if it doesn't exist
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add an updated_at field if it doesn't exist
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_accounts_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Add a comment to the table for clarity
COMMENT ON TABLE accounts IS 'Stores financial accounts for users, linked from various providers like Plaid or added manually.';
