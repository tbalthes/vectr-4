-- Temporarily disable foreign key constraint to allow merchant/category re-import
-- Use this when you need to completely refresh merchant and category data

-- 0. Handle column mapping issues - plain_name was renamed to name
-- If your CSV still has plain_name column, you may need to:
-- 1. Either update your CSV to use 'name' instead of 'plain_name'
-- 2. Or temporarily add plain_name column: ALTER TABLE categories ADD COLUMN plain_name TEXT;

-- 1. Drop ALL foreign key constraints that reference categories
ALTER TABLE transaction_categories 
DROP CONSTRAINT IF EXISTS fk_transaction_categories_category_id;

ALTER TABLE merchants 
DROP CONSTRAINT IF EXISTS merchants_default_category_id_fkey;

ALTER TABLE merchants 
DROP CONSTRAINT IF EXISTS fk_merchants_category_id;

-- Also drop any other potential FK constraints on categories
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS transactions_category_id_fkey;

ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS transactions_primary_category_id_fkey;

-- 2. Now you can delete and re-import your merchants/categories
-- DELETE FROM merchants;
-- DELETE FROM categories WHERE user_id IS NULL; -- Keep user-specific categories
-- <Import your new data here>

-- 3. Re-add the foreign key constraints after import (drop first if they exist)
ALTER TABLE transaction_categories 
DROP CONSTRAINT IF EXISTS fk_transaction_categories_category_id;

ALTER TABLE transaction_categories 
ADD CONSTRAINT fk_transaction_categories_category_id 
FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE;

ALTER TABLE merchants 
DROP CONSTRAINT IF EXISTS fk_merchants_default_category_id;

ALTER TABLE merchants 
ADD CONSTRAINT fk_merchants_default_category_id 
FOREIGN KEY (default_category_id) REFERENCES categories(category_id) ON DELETE SET NULL;

ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS fk_transactions_category_id;

ALTER TABLE transactions 
ADD CONSTRAINT fk_transactions_category_id 
FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL;

ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS fk_transactions_primary_category_id;

ALTER TABLE transactions 
ADD CONSTRAINT fk_transactions_primary_category_id 
FOREIGN KEY (primary_category_id) REFERENCES categories(category_id) ON DELETE SET NULL;

-- Verify the constraint was re-added
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
