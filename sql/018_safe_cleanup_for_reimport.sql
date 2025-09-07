-- Safe approach: Clean up data step by step to avoid constraint violations

-- 1. First, clean up transaction_categories that reference categories you want to delete
DELETE FROM transaction_categories 
WHERE category_id IN (
    SELECT category_id FROM categories 
    WHERE user_id IS NULL  -- Only global categories, preserve user categories
);

-- 2. Update transactions to remove direct category references
UPDATE transactions 
SET category_id = NULL, merchant_id = NULL
WHERE category_id IN (
    SELECT category_id FROM categories 
    WHERE user_id IS NULL
);

-- 3. Now you can safely delete merchants and categories
DELETE FROM merchants;
DELETE FROM categories WHERE user_id IS NULL;

-- 4. After this, you can import your new CSV data
-- The transactions will get re-categorized when you process them through the backend
