-- Option 2: Temporarily add plain_name column to match your CSV
ALTER TABLE categories ADD COLUMN IF NOT EXISTS plain_name TEXT;

-- After import, you can copy plain_name to name if needed:
-- UPDATE categories SET name = plain_name WHERE name IS NULL OR name = '';

-- Then drop the temporary column:
-- ALTER TABLE categories DROP COLUMN plain_name;
