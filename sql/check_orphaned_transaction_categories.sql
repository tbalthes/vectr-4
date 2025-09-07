-- Check for orphaned records in transaction_categories before adding foreign key constraint
-- This will help identify any data integrity issues

-- Find transaction_categories records that don't have matching categories
SELECT 
    tc.transaction_id,
    tc.category_id,
    tc.source,
    tc.created_at
FROM transaction_categories tc
LEFT JOIN categories c ON tc.category_id = c.category_id
WHERE c.category_id IS NULL
LIMIT 10;

-- Count total orphaned records
SELECT COUNT(*) as orphaned_records
FROM transaction_categories tc
LEFT JOIN categories c ON tc.category_id = c.category_id
WHERE c.category_id IS NULL;
