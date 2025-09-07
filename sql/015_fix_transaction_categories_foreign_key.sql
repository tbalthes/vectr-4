-- ✅ COMPLETED: Fix missing foreign key relationship between transaction_categories and categories
-- After Plaid migration, the foreign key constraint was missing
-- 
-- RESULTS:
-- - Foreign key constraint successfully added
-- - No orphaned records found (0 orphaned_records)
-- - Both relationships now intact:
--   * transaction_categories.transaction_id → transactions.id
--   * transaction_categories.category_id → categories.category_id

-- The SQL commands that were executed:
-- 1. Check for orphaned records (returned 0)
-- 2. Add foreign key constraint (completed successfully)

-- Add foreign key constraint from transaction_categories.category_id to categories.category_id
ALTER TABLE transaction_categories 
ADD CONSTRAINT fk_transaction_categories_category_id 
FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE;

-- Verify the constraint was added
SELECT 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name='transaction_categories';
