-- Update the foreign key constraint to use CASCADE DELETE
-- This will automatically clean up transaction_categories when categories are deleted

-- 1. Drop the existing constraint
ALTER TABLE transaction_categories 
DROP CONSTRAINT IF EXISTS fk_transaction_categories_category_id;

-- 2. Re-add with CASCADE DELETE (this will auto-clean orphaned records)
ALTER TABLE transaction_categories 
ADD CONSTRAINT fk_transaction_categories_category_id 
FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE;

-- Now when you delete categories, related transaction_categories will be automatically removed
