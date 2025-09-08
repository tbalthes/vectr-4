-- Add needs_review field to transactions table if it doesn't exist
-- This field tracks whether a transaction needs manual review

ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false NOT NULL;

-- Add index for efficient querying of transactions that need review
CREATE INDEX IF NOT EXISTS idx_transactions_needs_review 
  ON public.transactions(needs_review) 
  WHERE needs_review = true;

-- Update any existing transactions that might have NULL values
UPDATE public.transactions 
SET needs_review = false 
WHERE needs_review IS NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.transactions.needs_review IS 'Indicates whether this transaction requires manual review by the user';
