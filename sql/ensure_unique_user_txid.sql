-- Ensure unique constraint on (user_id, aggregator_transaction_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'transactions_user_txid_unique'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_user_txid_unique
      UNIQUE (user_id, aggregator_transaction_id);
  END IF;
END $$;
