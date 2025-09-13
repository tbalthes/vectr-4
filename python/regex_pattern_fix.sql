-- SQL to update PostgreSQL regex patterns to standard patterns
UPDATE merchants 
SET regex_match = REGEXP_REPLACE(regex_match, '^\(\?\i\)', '', 'g')
WHERE regex_match LIKE '(?i)%';

-- Check patterns that still might have issues
SELECT merchant_id, name, regex_match 
FROM merchants 
WHERE regex_match ~ '[\(\)\?]' 
AND is_active = true;
