-- Fix for null plain_name constraint during import
-- Run this BEFORE importing your CSV data

-- Option 1: Temporarily make plain_name nullable
ALTER TABLE categories ALTER COLUMN plain_name DROP NOT NULL;

-- After import, you can update any null plain_name values to use the name field
UPDATE categories 
SET plain_name = name 
WHERE plain_name IS NULL OR plain_name = '';

-- Option 2: Alternative - make plain_name nullable permanently and use name as fallback
-- This is actually better for flexibility
-- ALTER TABLE categories ALTER COLUMN plain_name DROP NOT NULL;
