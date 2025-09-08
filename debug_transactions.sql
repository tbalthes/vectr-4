-- Check if transactions are being stored
SELECT 
    COUNT(*) as total_transactions,
    COUNT(DISTINCT account_id) as accounts_with_transactions,
    MIN(date) as earliest_transaction,
    MAX(date) as latest_transaction,
    MAX(created_at) as last_created
FROM transactions 
WHERE user_id IS NOT NULL;

-- Check account links status
SELECT 
    provider,
    status,
    last_sync_at,
    cursor,
    COUNT(*) as count
FROM account_links 
GROUP BY provider, status, last_sync_at, cursor
ORDER BY last_sync_at DESC NULLS LAST;

-- Check recent transactions with details
SELECT 
    t.id,
    t.amount,
    t.date,
    t.original_description,
    t.clean_description,
    t.created_at,
    a.name as account_name,
    a.provider
FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.id
ORDER BY t.created_at DESC
LIMIT 10;
