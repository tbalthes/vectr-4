-- Add the account_link_id column to the accounts table if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='account_link_id') THEN
    ALTER TABLE public.accounts ADD COLUMN account_link_id UUID;
  END IF;
END $$;

-- Add a foreign key constraint to link accounts to account_links, dropping it first if it exists
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name='accounts' AND constraint_name='fk_account_links') THEN
    ALTER TABLE public.accounts DROP CONSTRAINT fk_account_links;
  END IF;
END $$;

ALTER TABLE public.accounts
ADD CONSTRAINT fk_account_links
FOREIGN KEY (account_link_id)
REFERENCES public.account_links(id)
ON DELETE SET NULL;
