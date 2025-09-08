-- Add needs_review column to transactions table if it doesn't exist
-- This fixes the "null value in column needs_review violates not-null constraint" error

-- Add the column as nullable first
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS needs_review boolean;

-- Set default value for existing records
UPDATE public.transactions 
SET needs_review = false 
WHERE needs_review IS NULL;

-- Make the column not null with default
ALTER TABLE public.transactions 
  ALTER COLUMN needs_review SET DEFAULT false,
  ALTER COLUMN needs_review SET NOT NULL;

-- Add comment
COMMENT ON COLUMN public.transactions.needs_review IS 'Whether this transaction needs manual review for categorization';
