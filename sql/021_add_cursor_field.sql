-- Add cursor field to account_links for Plaid transaction sync pagination
-- This stores the next_cursor value returned by /transactions/sync

ALTER TABLE public.account_links 
  ADD COLUMN IF NOT EXISTS cursor text;

COMMENT ON COLUMN public.account_links.cursor IS 'Plaid transactions/sync cursor for pagination';
