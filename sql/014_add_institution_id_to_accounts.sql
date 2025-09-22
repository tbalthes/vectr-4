ALTER TABLE accounts
ADD COLUMN institution_id TEXT REFERENCES institutions(institution_id);

CREATE INDEX IF NOT EXISTS idx_accounts_institution_id ON accounts(institution_id);
