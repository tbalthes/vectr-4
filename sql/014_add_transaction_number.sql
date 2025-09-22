-- Add a transaction_number column to store non-UUID transaction identifiers,
-- primarily for transactions imported from CSV files where the bank-provided
-- identifier may not be a UUID. This allows preserving original identifiers
-- while using a UUID as the primary key.
ALTER TABLE public.transactions
ADD COLUMN transaction_number TEXT;
