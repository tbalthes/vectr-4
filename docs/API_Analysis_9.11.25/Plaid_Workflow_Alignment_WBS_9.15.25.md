# Plaid Workflow Alignment — MVP WBS (2025-09-15)

Purpose: distill the larger migration WBS into a minimal, high-value plan that gets Plaid data reliably into the product while minimizing Plaid API usage, engineering effort, and security risk.

Principles for this MVP
- Treat our DB as the source of truth; serve UI from cached DB records.
- Rely on Plaid webhooks (primarily `SYNC_UPDATES_AVAILABLE`) for transaction updates; avoid polling.
- Keep manual refresh as a fire-and-forget trigger that funnels results back through the webhook flow.
- Implement minimal, high-impact security (webhook JWS verification, idempotency keys, parameterized queries).
- Make changes small, testable, and reversible.

Priority phases (MVP scope)

Phase A — Core Plaid Alignment (Highest Priority)
1. Standardize item records
   - Where: `public.account_links` already exists; columns align with needs: `item_id`, `user_id`, `access_token_encrypted`, `cursor`, `status`, `last_sync_at` (per `sql/020_plaid_api_enhancement.sql`).
   - Steps:
     1) Verify schema migration has run in staging/prod: `sql/020_plaid_api_enhancement.sql` (adds item_id, cursor, last_sync_at, etc.).
     2) Ensure all code paths use `account_links` as the canonical item store:
        - Next.js: `src/app/api/aggregator/webhook/route.ts` lines ~372–407 query `account_links` by `item_id`.
        - Python: `python/app/routers/plaid_api.py` lines ~46–64 select `user_id, access_token_encrypted` by `item_id`.
     3) Add `last_webhook_received_at` column if desired (optional) via a small SQL migration; otherwise reuse `updated_at`.
     4) Update write-backs to use `cursor` and `last_sync_at` consistently:
        - Next.js sync: `src/app/api/aggregator/plaid/transactions/sync/route.ts` lines ~141–162 update `account_links.cursor` and `last_sync_at`.
   - Acceptance: single source-of-truth row per item; sync writes update `cursor/last_sync_at` atomically.

2. Webhook endpoint hardening
   - Where: Next.js `src/app/api/aggregator/webhook/route.ts`.
   - Steps:
     1) JWS verification is partially implemented in `verifyPlaidWebhook` lines ~27–198 and ~200–259 using `jose` with fallback. Ensure `jose` is installed and required env vars set (`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`).
     2) Replace ad-hoc `eventId` with deterministic dedupe key from Plaid payload (e.g., `${item_id}:${webhook_type}:${webhook_code}:${payload?.env_ts || payload?.time || req.headers['x-request-id'] || hash(body)}`) and persist it.
     3) Persist events: already inserts into `webhook_events` at lines ~52–77; extend columns to include `item_id`, `webhook_type`, `webhook_code`, and `dedupe_key` (ensure columns exist per `sql/020_plaid_api_enhancement.sql`).
     4) Mark unverified requests as 401 early (already done at lines ~22–26) and log minimal metadata.
   - Acceptance: invalid signatures rejected; verified events stored with deterministic `dedupe_key`.

3. Idempotency & dedupe
   - Where: Next.js `src/app/api/aggregator/webhook/route.ts` and sync trigger function `triggerTransactionSync` lines ~360–430.
   - Steps:
     1) Before processing, check `webhook_events` for existing `dedupe_key` with `status in ('received','processed')`; if exists, return early (idempotent ack) and do not trigger sync.
     2) After successful sync, update the stored event row to `status='processed'`, set `processed_at=now()` (add update near the end of POST handler).
     3) Add a unique index on `webhook_events(dedupe_key)` for hard guarantees.
     4) Document replay tolerance: re-sending same webhook causes no additional transaction writes due to cursor and dedupe checks.
   - Acceptance: replaying the same webhook does not re-trigger sync or create duplicate transactions.

4. Sync trigger reduction
   - Where: Next.js `src/app/api/aggregator/webhook/route.ts` `handleTransactionsWebhook` lines ~270–328.
   - Steps:
     1) Change switch-case to only trigger sync for `SYNC_UPDATES_AVAILABLE` (and optionally initial link confirmation), comment out/remove `INITIAL_UPDATE`, `HISTORICAL_UPDATE`, `DEFAULT_UPDATE`, and `TRANSACTIONS_REMOVED` triggers.
     2) Keep `TRANSACTIONS_REMOVED` optional: rely on `/transactions/sync` to handle removals via `removed[]` in subsequent syncs.
     3) Add structured log indicating skipped triggers for traceability.
   - Acceptance: only `SYNC_UPDATES_AVAILABLE` triggers `triggerTransactionSync` by default.

5. Transactions sync flow (fire-and-forget background job)
   - Where: Next.js `src/app/api/aggregator/plaid/transactions/sync/route.ts`.
   - Steps:
     1) Ensure this route returns quickly when invoked by webhooks: it already fetches the entire pagination loop internally (lines ~208–294). For MVP, okay; for longer-term, enqueue background job. Keep as is but avoid chained loops from callers.
     2) In callers (webhook, manual), avoid while-loops that chain additional sync requests; rely on this endpoint to loop until `has_more=false`.
        - Update `src/app/api/aggregator/plaid/sync-account/route.ts` lines ~64–126 to call sync once (remove loop) and return 202.
     3) Atomic cursor updates: already updates `account_links.cursor` with `next_cursor` at lines ~141–162. Wrap processing + cursor update in a DB transaction if supported; for MVP, keep single update and log failures.
     4) Upserts: added/modified are processed through clean processor (lines ~69–139, ~167–205). Confirm unique keys on `transactions(aggregator_transaction_id, user_id)` to avoid duplicates.
   - Acceptance: sync completes via a single call per trigger, cursor persisted, callers return quickly; no duplicate upserts.

Phase B — Manual Refresh & UX integration (High Priority)
6. Manual refresh endpoint
   - Create `/api/plaid/refresh-item` which: verifies user auth/ownership, enqueues a Plaid refresh call (or triggers Plaid endpoint that will eventually send a webhook), and returns 202 Accepted immediately.
   - Client-side: debounce / disable refresh button for 5 minutes after success (UI change - recommended but can be short-circuited for v0).
   - Acceptance: manual refresh returns 202 quickly and results, if any, arrive via webhooks and DB updates.

7. One-time static pulls at onboarding
   - At `public_token` exchange, immediately fetch Accounts and any necessary static metadata once and persist to DB (account ids, names, masks). Do not re-fetch on page loads.
   - Acceptance: newly linked accounts appear in DB and UI without repeated calls.

Phase C — Security & Basic Operations (Medium Priority)
8. Parameterized queries & secrets handling
   - Audit critical DB paths used by Plaid flows and ensure parameterized queries or ORM usage to prevent injection. Confirm access_tokens are stored encrypted (or in secrets manager) and never returned to clients.
   - Acceptance: no plaintext access_tokens in repo or API responses; DB queries parameterized.

9. Minimal rate-limiting & abuse protection
   - Add simple per-user rate limits for the manual refresh endpoint (e.g., 1 per 5 minutes) and protect webhook endpoint from abusive IPs via basic filtering if available.
   - Acceptance: manual refresh calls are rate-limited and rejected with 429 when abused.

Phase D — Performance & Observability (Low-Medium Priority)
10. Cursor & indexing improvements
    - Add DB indexes on `transactions(item_id, date)` and `transactions(id)` as needed. Ensure `transactions_cursor` updates happen atomically to avoid race conditions.
    - Acceptance: transaction upsert queries use indexes; cursors update in the same DB transaction as the last processed batch.

11. Structured logs & basic monitoring
    - Log key lifecycle events with `request_id`: webhook receipt, sync start/finish, cursor updates, sync errors. Integrate a simple error capture (console/Sentry free tier) to aggregate exceptions.
    - Acceptance: errors and sync failures appear in logs/monitoring and include item_id and request_id.

Phase E — Tests, Rollback & Launch Checklist (Required before release)
12. Tests
    - Unit tests for webhook verification and dedupe logic.
    - Integration test (local or CI) that simulates a Plaid `SYNC_UPDATES_AVAILABLE` webhook flow and confirms DB upserts and cursor updates.
    - Acceptance: tests pass in CI; at least one integration path validates end-to-end flow.

13. Rollback & feature flagging
    - Wrap major changes behind a simple feature flag / env var (e.g., `PLAID_MVP_SYNC_ENABLED`) so you can revert to legacy behavior quickly.
    - Acceptance: feature flag disables new webhook handling and falls back to existing behavior.

14. Launch checklist
    - Confirm webhook secret(s) are set in production envs.
    - Confirm the DB migration for `transactions_cursor` and event table ran in staging.
    - Confirm manual refresh rate limit is configured.
    - Confirm monitoring alerts for sync failures (email/Slack or Sentry issue).

Quick Prioritized Backlog (next steps)
- Immediate (1–3 days): Steps 1,2,3,5,6 (canonical item table, webhook verification, dedupe, background sync, manual refresh).
- Short (1–2 weeks): Steps 7,8,9,10 (onboarding pulls, encryption audit, rate-limiting, indexing).
- Medium (2–4 weeks): Steps 11,12,13,14 (logs, tests, feature flagging, launch checklist).

Edge cases and notes
- Plaid webhook retries: Plaid can retry delivery — ensure dedupe and idempotency guard against re-processing.
- Partial sync failures: If a batch fails mid-sync, ensure the cursor is only advanced after successful persistence of the batch.
- Concurrent syncs: Prevent concurrent syncs for the same item (use a DB lock or an in-memory lock keyed by `item_id`).

Acceptance criteria mapping
- Data correctness: transactions for a given item are upserted exactly once per Plaid-provided change (Done when tests pass and replays don't duplicate).
- Cost control: no polling endpoints running in production; manual refresh uses Plaid refresh flow and webhooks (Done when no scheduled polling jobs exist).
- Security: invalid webhooks rejected, access_tokens encrypted and never returned (Done when audit passes).

Document history
- 2025-09-15: MVP distilled and written by engineering; intended as a lean replacement of the larger WBS for initial rollout.
