-- Cleanup script to delete all transaction, account, and institution data
-- Execute these statements in order to respect foreign key constraints

-- 1. Delete all transactions first (they reference accounts)
DELETE FROM transactions;

-- 2. Delete all accounts (they reference institutions and account_links)
DELETE FROM accounts;

-- 3. Delete all account links (they reference institutions)
DELETE FROM account_links;

-- 4. Delete all institutions last (they are referenced by accounts and account_links)
DELETE FROM institutions;

-- Optional: Reset any auto-increment sequences if you want clean IDs
-- (Uncomment these if your tables use auto-incrementing primary keys)
-- ALTER SEQUENCE transactions_id_seq RESTART WITH 1;
-- ALTER SEQUENCE accounts_id_seq RESTART WITH 1;
-- ALTER SEQUENCE institutions_id_seq RESTART WITH 1;

-- Verify cleanup (should all return 0)
SELECT 'transactions' as table_name, COUNT(*) as record_count FROM transactions
UNION ALL
SELECT 'accounts' as table_name, COUNT(*) as record_count FROM accounts
UNION ALL
SELECT 'account_links' as table_name, COUNT(*) as record_count FROM account_links
UNION ALL
SELECT 'institutions' as table_name, COUNT(*) as record_count FROM institutions;