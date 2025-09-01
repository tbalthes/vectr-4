-- 003_add_transaction_ids.sql
-- Add merchant_id and category_id to transactions table so transactions can reference merchants and categories
-- Run this in Supabase SQL editor or via psql connected to your DB. Test in staging first.

BEGIN;

-- Add nullable columns to avoid blocking existing rows
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS merchant_id uuid NULL,
  ADD COLUMN IF NOT EXISTS category_id uuid NULL;

-- Add foreign key constraints if referenced tables exist
-- Use DEFERRABLE INITIALLY IMMEDIATE to keep behavior predictable in bulk imports
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchants') THEN
    BEGIN
      ALTER TABLE public.transactions
        ADD CONSTRAINT IF NOT EXISTS transactions_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_table THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
    BEGIN
      ALTER TABLE public.transactions
        ADD CONSTRAINT IF NOT EXISTS transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_table THEN NULL; END;
  END IF;
END$$;

-- Create indexes for faster joins/filters
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_id ON public.transactions (merchant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions (category_id);

COMMIT;

-- Notes:
-- 1) Run in a safe environment (staging) first. If your DB has triggers or RLS, ensure migration user has privileges.
-- 2) After applying, the existing backend logic that writes merchant_id/category_id will succeed and skip the metadata fallback.
-- 3) If you prefer to denormalize names as well, consider writing merchant_name/category_name into the transactions table (requires additional columns and a migration).
