
-- Balances table for storing account balances over time
CREATE TABLE IF NOT EXISTS public.balances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.accounts(account_id) ON DELETE CASCADE,
    available numeric,
    current numeric,
    iso_currency_code character(3),
    as_of timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- View: accounts with latest balance
CREATE OR REPLACE VIEW public.v_accounts_with_latest_balance AS
SELECT
    a.account_id,
    a.user_id,
    a.name,
    a.mask,
    a.type,
    a.subtype,
    b.current AS current_balance,
    b.available AS available_balance,
    b.iso_currency_code AS currency,
    al.institution_id,
    al.institution_name,
    i.logo_url AS institution_logo_url,
    al.status AS link_status,
    a.created_at,
    a.updated_at
FROM
    public.accounts a
LEFT JOIN LATERAL (
    SELECT bal.current, bal.available, bal.iso_currency_code
    FROM public.balances bal
    WHERE bal.account_id = a.account_id
    ORDER BY bal.as_of DESC, bal.created_at DESC
    LIMIT 1
  ) b ON TRUE
LEFT JOIN public.account_links al ON a.account_link_id = al.id
LEFT JOIN public.institutions i ON al.institution_id = i.institution_id
WHERE a.deleted_at IS NULL;
