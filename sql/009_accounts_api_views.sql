-- 009_accounts_api_views.sql
-- Read models to serve the Accounts page in one query (depends on balances)

BEGIN;

CREATE OR REPLACE VIEW public.v_accounts_with_latest_balance AS
SELECT
  a.id AS account_id,
  a.user_id,
  a.name,
  a.mask,
  a.type,
  a.currency,
  a.provider,
  a.aggregator_account_id,
  a.institution_id,
  i.name AS institution_name,
  i.logo_url AS institution_logo_url,
  a.last_synced_at,
  lb.balance_amount,
  lb.available,
  lb.as_of AS balance_as_of
FROM public.accounts a
LEFT JOIN LATERAL (
  SELECT b.balance_amount, b.available, b.as_of
  FROM public.balances b
  WHERE b.account_id = a.id
  ORDER BY b.as_of DESC
  LIMIT 1
) lb ON TRUE
LEFT JOIN public.institutions i ON i.id = a.institution_id;

COMMENT ON VIEW public.v_accounts_with_latest_balance IS 'Accounts joined with latest balance and institution meta for API consumption.';

COMMIT;
