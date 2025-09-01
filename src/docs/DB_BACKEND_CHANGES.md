# DB & Backend Changes — Transaction Editor, Categories, and Audit

This document explains the schema, SQL and backend (FastAPI) changes made to support an atomic Transaction Editor, custom categories, and an audit trail. It lists files added/modified, how to run the migrations and smoke tests, verification steps, and suggested next steps / cleanup items.

## Summary

- Added atomic RPCs to update transactions and category links in a single DB transaction.
- Added a versioned RPC to add transaction-category links and create audit rows.
- Migrated `transactions.needs_review` from text -> boolean (preview migration + finalize migration).
- Updated backend routers to call the RPCs and to pass authenticated user ids for audit rows.
- Added tests that mock Supabase and assert RPC calls include `p_user_id`.

## Files added or changed

### SQL (under `sql/`)

- `install_and_smoke.sql` — installer: creates functions, grants, and runs smoke tests.
- `add_transaction_category_v2.sql` — versioned RPC: requires non-null `p_user_id`, writes audit row.
- `patch_transaction_atomic.sql` — atomic RPC: updates transaction, replaces category links, writes audit row; requires `p_user_id`.
- `migrate_needs_review_to_boolean.sql` — preview migration: adds `needs_review_bool` and backfills recognizable values.
- `finalize_needs_review_boolean.sql` — destructive finalize migration: creates backup, coerces NULLs, sets NOT NULL, renames column.

### Backend (Python FastAPI)

- `python/app/routers/transactions.py` — PATCH now validates and passes `p_user_id` to RPCs.
- `python/app/routers/transaction_upload.py` — Upload endpoint validates `payload.user_id` and passes it into `add_transaction_category_v2` RPC.

### Tests

- `python/tests/test_rpc_user_id.py` — Mock Supabase and assert RPCs include `p_user_id`.

## Rationale

- Atomic RPCs prevent race conditions and guarantee a single audit record represents the full change.
- Requiring `p_user_id` ensures audit integrity.
- Migrating `needs_review` to boolean prevents type-mismatch issues and simplifies code.

## How to apply the changes

1. (Optional) Drop old function signatures if you need to update parameter defaults:

```sql
DROP FUNCTION IF EXISTS public.add_transaction_category_v2(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.patch_transaction_atomic(uuid, uuid, uuid[], text, text, uuid, boolean);
```

2. Run `sql/install_and_smoke.sql` in the Supabase SQL editor (service role) to create the RPCs and run smoke tests.

3. If you ran the preview migration, run `sql/finalize_needs_review_boolean.sql` to make the boolean authoritative. The file creates a backup table first.

## How to run backend tests

From the `python/` folder with the venv active:

```powershell
Activate venv: run the activation script at .venv\Scripts\Activate.ps1
python -m pytest -q tests\test_rpc_user_id.py
```

## Verification steps

- Run the installer and inspect the returned row: check `add_rpc_result` and `patch_rpc_result` contain `audit_id` and `before`/`after` snapshots.
- Verify `transaction_edits` contains audit rows with correct `user_id` values.
- Run the pytest tests (they pass locally: 2 passed, 6 warnings).

## Next steps / cleanup

- Remove old function versions if not needed.
- Replace per-row RPC calls in uploads with a bulk RPC for performance.
- Tighten DB permissions for `merchants` and provide admin RPC for creation if necessary.
- Add CI to run tests on push/PR.

---

Revision: 2025-08-31
