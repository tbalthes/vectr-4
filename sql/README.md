SQL functions for transaction editing and category management

## Overview

This folder contains PostgreSQL functions intended to be applied to your Supabase/Postgres database to provide atomic transaction editing behavior and a safe API for adding category links.

## Files

- `patch_transaction_atomic.sql` — a plpgsql function `public.patch_transaction_atomic(...)` which atomically updates a transaction, replaces its category links when provided, and inserts an audit row into `transaction_edits`.
  -- `add_transaction_category.sql` — legacy function `public.add_transaction_category(...)` (may return void in older installs).
  -- `add_transaction_category_v2.sql` — versioned replacement that returns jsonb and writes audit rows; preferred for new installs.

## How to apply

1. Open the Supabase dashboard for your project and go to the SQL editor (or run via psql with a service role connection).
2. Copy the contents of `patch_transaction_atomic.sql` and run it. Then run `add_transaction_category_v2.sql` (or `add_transaction_category.sql` if you prefer the legacy signature).
3. Confirm functions exist with: SELECT proname FROM pg_proc WHERE proname IN ('patch_transaction_atomic','add_transaction_category');

## Quick tests

Run these queries in Supabase SQL editor to smoke-test the functions (replace `:tx_id`, `:cat_id`, and `:user_id`):

-- Test add_transaction_category_v2
SELECT public.add_transaction_category_v2('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000100'::uuid);

-- Test patch_transaction_atomic
SELECT public.patch_transaction_atomic(
'00000000-0000-0000-0000-000000000002'::uuid,
NULL,
ARRAY['00000000-0000-0000-0000-000000000010'::uuid],
'Short cleaned description',
'Edited via API',
'00000000-0000-0000-0000-000000000100'::uuid,
TRUE
);

## Notes & recommendations

- Ensure the tables `transactions`, `transaction_categories`, and `transaction_edits` exist and that `transaction_categories` has a `created_at` timestamptz column and `transaction_edits` has the expected columns used by the functions.
- These functions rely on `gen_random_uuid()` (pgcrypto). If not available, install the extension: `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`.
- `transaction_edits.user_id` is NOT NULL in this schema. If you call `add_transaction_category_v2` with a NULL `p_user_id`, the function falls back to the first profile id as the audit user; adjust this behavior to suit your security model.
- For bulk uploads, prefer implementing a `bulk_add_transaction_categories(jsonb)` function that does many inserts in a single transaction to avoid RPC-per-row overhead.
