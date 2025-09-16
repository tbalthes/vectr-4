# API Migration WBS: Align Codebase To Ideal Plaid Workflow

## 0. Preparation & Safety

- Server-only boundaries and import audit

  - Add `import "server-only"` to sensitive modules (Supabase admin, Plaid client, env loaders).
  - Audit client imports to ensure no server-only modules are imported by client components.
  - Acceptance: Sensitive modules are guarded; no accidental client bundling.

- Branch strategy & CI updates (optional for solo dev)
  - Keep work on `transaction_processing_updates` or a short-lived feature branch per section.
  - Acceptance: Lint, typecheck, and unit tests pass locally before merging.

---

## 1. Service Extraction (Source of Truth in Services)

### 1.0 Shared API utilities

- 1.0.1 Create `src/lib/api/auth.ts`

  - Implement server-side auth/session extraction (e.g., Supabase cookies, headers).
  - Acceptance: Can extract user/session from request in all API routes.

- 1.0.2 Create `src/lib/api/validator.ts`

  - Implement Zod-based validation helpers for body/query/params.
  - Acceptance: All API routes use this for input validation; invalid input returns 400 with error details.

- 1.0.3 Create `src/lib/api/errors.ts`

  - Implement standardized error response helpers (e.g., `error(code, message, status)`).
  - Acceptance: All error responses use this format; no ad-hoc error shapes.

- 1.0.4 Create `src/lib/api/sentry.ts`

  - Initialize Sentry (or equivalent) for error monitoring; export capture helper.
  - Acceptance: Errors in API routes are captured in Sentry in dev/prod.

- 1.0.5 Create `src/lib/api/rateLimit.ts`

  - Implement lightweight rate limiting helpers (e.g., per-IP, per-user) for hot endpoints.
  - Acceptance: Can apply rate limiting to any route; excessive requests are throttled.

- 1.0.6 Refactor API routes to use helpers
  - Replace inline auth, validation, error, and rate limit logic with shared helpers above.
  - Acceptance: No duplicate logic in routes; all use shared helpers for these concerns.

### 1.1 Create `src/lib/plaid/` services

- 1.1.1 Create `src/lib/plaid/client.ts`

  - Implement Plaid API client wrapper (auth, request helpers, error handling).
  - Acceptance: All Plaid API calls go through this client; errors are handled consistently.

- 1.1.2 Create `src/lib/plaid/transactions.ts`

  - Implement transaction sync, fetch, and upsert logic.
  - Acceptance: All transaction-related logic is in this module; API routes call these functions only.

- 1.1.3 Create `src/lib/plaid/accounts.ts`

  - Implement account fetch, balance, and mapping logic.
  - Acceptance: All account-related logic is in this module; API routes call these functions only.

- 1.1.4 Create `src/lib/plaid/webhooks.ts`

  - Implement webhook verification, parsing, and event routing logic.
  - Acceptance: Webhook handler uses this for all verification and event parsing.

- 1.1.5 Create `src/lib/plaid/sync.ts`

  - Implement orchestration for multi-page sync, cursor management, and idempotency.
  - Acceptance: Sync logic is isolated; API routes only trigger sync, not manage it.

- 1.1.6 Create `src/lib/plaid/types.ts`

  - Define shared types/interfaces for Plaid data, events, and service contracts.
  - Acceptance: All Plaid modules use these types; no ad-hoc type definitions.

- 1.1.7 Refactor API routes to use Plaid services
  - Move orchestration logic from API route handlers into the above modules.
  - Acceptance: API routes are thin controllers (validate, call service, return response).

### 1.2 Centralize Supabase DB access

- 1.2.1 Create `src/lib/db/items.ts`

  - Implement typed functions for item CRUD and status updates.
  - Acceptance: All item DB access goes through this module.

- 1.2.2 Create `src/lib/db/accounts.ts`

  - Implement typed functions for account CRUD and mapping.
  - Acceptance: All account DB access goes through this module.

- 1.2.3 Create `src/lib/db/transactions.ts`

  - Implement typed functions for transaction CRUD, upsert, and queries.
  - Acceptance: All transaction DB access goes through this module.

- 1.2.4 Create `src/lib/db/cursors.ts`

  - Implement typed functions for cursor read/write per item.
  - Acceptance: All cursor DB access goes through this module.

- 1.2.5 Refactor API routes to use DB modules
  - Remove direct DB calls from route handlers; use only these modules.
  - Acceptance: No direct DB calls in API routes.

### 1.3 Contracts & typing

- 1.3.1 Define input/output interfaces for all service functions

  - Specify TypeScript interfaces for all Plaid and DB service boundaries.
  - Acceptance: All service functions are strongly typed.

- 1.3.2 Add Zod schemas for inbound payloads
  - Define Zod schemas for all API route inputs (body, query, params).
  - Acceptance: All API routes validate input with Zod; invalid input returns 400.

### 1.4 Remove / proxy-to-Supabase routes (designate for cleanup in section 11 as well)

- 1.4.1 Inventory all API routes that proxy to Supabase

  - List all routes that only forward CRUD to Supabase.
  - Acceptance: Complete inventory of proxy routes.

- 1.4.2 Plan migration of consumers to use `@supabase/supabase-js` directly

  - Document migration steps for each proxy route.
  - Acceptance: Migration plan exists for all proxy routes.

- 1.4.3 Remove or refactor proxy routes
  - Remove or refactor routes to eliminate proxy-only logic.
  - Acceptance: Only value-adding routes remain; documentation updated.

### 1.5 Processing performance helpers

- 1.5.1 Create `src/lib/processing/caches.ts`

  - Implement request-scoped caches for accounts, categories, merchants.
  - Acceptance: Clean/sync services use these caches; no per-row DB lookups for cached data.

- 1.5.2 Create `src/lib/perf.ts`

  - Implement timing helper to measure and log durations for fetch, map, and bulk upsert phases.
  - Acceptance: Logs include phase timings and counts; no payload bodies.

- 1.5.3 Refactor clean/sync services to use helpers
  - Use caches and timing helpers in all clean/sync logic.
  - Acceptance: Clean/sync services are efficient and instrumented for performance.

---

## 2. Webhook Verification & Routing

### 2.1 Implement Plaid JWS/signature verification

- Add verification utility in `src/lib/plaid/webhooks.ts`.
- Reject unverified requests with 401.
- Acceptance: Valid Plaid webhooks pass; tampered payloads are rejected.

- 2.1.1 Add verification utility

  - Create `src/lib/plaid/verify.ts` to encapsulate JWS/PS256 signature verification using the Plaid public key(s) and timestamp checks.
  - Add configuration support for keys via env (`PLAID_WEBHOOK_PUBLIC_KEY`, or JWKS URL) and caching of keys with TTL.
  - Acceptance: Verification utility exposes `verifyPlaidWebhook(headers, body)` → throws `verification_error` on failure.

- 2.1.2 Unit tests for verification

  - Add unit tests that validate good signatures, expired timestamps, and tampered payloads.
  - Acceptance: Tests cover success and 2 failure modes.

### 2.2 Normalize webhook handler

- Route: `/api/aggregator/webhook` handles TRANSACTIONS events.
- Only enqueue/signal sync on `SYNC_UPDATES_AVAILABLE` (plus onboarding bootstraps where needed).
- Acceptance: DEFAULT/HISTORICAL/other non-essential codes do not trigger sync.

- 2.2.1 Create normalized webhook handler

  - Implement `src/lib/plaid/webhooks.ts` with `parsePlaidEvent(headers, body)` and `handlePlaidEvent(event)` exported functions.
  - Handler responsibilities: verify signature (via `verify.ts`), parse event payload, normalize event object to internal shape, and route to appropriate processor (e.g., enqueue sync or call onboarding flow).
  - Acceptance: `/api/aggregator/webhook` uses these helpers; all parsing and verification logic removed from the route file.

- 2.2.2 Enqueue vs direct handling policy

  - Implement an `enqueueSync(itemId, reason)` helper that posts to a job queue (or a lightweight in-process queue for now) for `SYNC_UPDATES_AVAILABLE` events; onboarding bootstraps may call sync directly when safe.
  - Acceptance: `SYNC_UPDATES_AVAILABLE` events enqueue a job and return 200 quickly; heavy work not performed synchronously.

- 2.2.3 Integration tests for webhook routing

  - Add integration tests that POST sample Plaid webhook payloads to the route and assert the correct enqueue or skip behavior for different `webhook_type`/`webhook_code` combinations.
  - Acceptance: Integration test covers at least `SYNC_UPDATES_AVAILABLE`, `TRANSACTIONS_REMOVED`, and a non-triggering code.

### 2.3 Idempotency guard (event-level)

- Add `webhook_events` table or reuse an existing events table to store processed `event_id`/`item_id` with unique constraint.
- Skip processing on duplicate deliveries.
- Acceptance: Replays do not cause duplicated work.

- 2.3.1 Migration: create `webhook_events` table

  - Add SQL migration to create `webhook_events (id serial, event_id text, item_id text, processed_at timestamptz, payload jsonb, UNIQUE(event_id, item_id))` and index on `item_id`.
  - Acceptance: Migration applies; table present in DB.

- 2.3.2 Use idempotency guard in handler

  - In `src/lib/plaid/webhooks.ts`, before processing an event, insert into `webhook_events` with `ON CONFLICT DO NOTHING` and check affected rows to detect duplicates.
  - Acceptance: Duplicate events are detected and short-circuited; no duplicate jobs created.

- 2.3.3 Replay & duplicate tests

  - Add tests that simulate duplicate deliveries and confirm the second delivery is ignored and does not enqueue work.
  - Acceptance: Tests validate idempotency and ensure no duplicate processing.

- 2.3.4 Monitoring & alerting hooks

  - Emit a metric/log when duplicate webhooks are received (count) and when verification fails (for monitoring dashboards).
  - Acceptance: Duplicate and verification-failure metrics are available in logs or observability backend.

---

## 3. Transactions Sync Engine Hardening

3.1 Cursor management

- Ensure robust read/write of `transactions_cursor` per item.
- Continue calling `/transactions/sync` while `has_more` is true; update cursor per page safely.
- Acceptance: Full pagination until completion; final cursor persisted.

  3.2 Upsert logic for added/modified/removed

- Implement deterministic upsert for `added` and `modified`.
- Implement delete/soft-delete for `removed` per design.
- Acceptance: Net state in DB matches Plaid after sync; idempotent on retries.

  3.3 Unique identifiers & constraints

- Add DB unique constraint on `aggregator_transaction_id` (or equivalent) and supporting indexes.
- Acceptance: Duplicate inserts conflict cleanly; code handles conflicts idempotently.

  3.4 Structured logging & timings

- Add scoped logs for fetch/map/upsert phases with durations.
- Acceptance: Logs show per-phase timings and record counts for every sync run.

  3.5 Extract transactions clean/mapping pipeline

- Create `src/lib/transactions/clean.ts`, `mapping.ts`, and `bulk.ts` for normalization, merchant/category mapping, and bulk upsert/dedupe.
- Route handlers call these modules; logic removed from route files.
- Acceptance: Clean pipeline is unit-testable; handlers remain thin.

  3.6 Bulk persistence & concurrency limits

- Implement chunked bulk upsert (e.g., 250–500 rows per batch) with conflict target on `aggregator_transaction_id`.
- Limit any remaining async per-row operations with a small concurrency pool (e.g., 4–8) and avoid unbounded parallelism.
- Acceptance: Bulk upserts complete within target time windows; retries are idempotent via unique constraints.

### 3.1 Cursor management

- 3.1.1 Create `src/lib/transactions/cursors.ts`

  - Implement typed helpers: `getCursor(itemId)`, `setCursor(itemId, cursor)` with optimistic updates.
  - Acceptance: Cursor read/write behave atomically in tests; concurrent syncs don't corrupt cursor state.

- 3.1.2 Integration test for pagination
  - Add integration test that simulates multi-page `/transactions/sync` responses and verifies cursor progression and final persistence.
  - Acceptance: Test demonstrates multi-page sync completes and final cursor matches last page.

### 3.2 Upsert logic for added/modified/removed

- 3.2.1 Implement normalization & dedupe keys

  - Define canonical `aggregator_transaction_id` calculation and mapping from Plaid payload to DB columns.
  - Acceptance: Mapping logic returns stable keys for identical Plaid transactions.

- 3.2.2 Implement deterministic bulk upsert pipeline

  - Implement `src/lib/transactions/bulk.ts` exposing `bulkUpsertTransactions(rows, batchSize)` that writes in chunks and uses `ON CONFLICT` on `aggregator_transaction_id` to update fields deterministically.
  - Acceptance: Bulk writes are idempotent; repeated runs do not create duplicates and update changed fields predictably.

- 3.2.3 Implement remove/soft-delete handling
  - Implement `markRemovedTransactions(aggregatorIds[])` to soft-delete or archive removed transactions.
  - Acceptance: Removed transaction lists are reflected in DB state; soft-deleted rows are excluded from regular reads.

### 3.3 Unique identifiers & constraints

- 3.3.1 Add migrations for unique constraints & indexes

  - Create SQL migration(s) to add unique index on `aggregator_transaction_id`, indexes on `(user_id, date DESC)`, and any merchant/account indexes from WBS section 9.
  - Acceptance: Migrations apply and rollback; schema validated in CI.

- 3.3.2 Backfill dedupe where needed
  - Run a backfill script to detect and resolve existing duplicates (mark duplicates, choose canonical row, and update foreign keys if needed).
  - Acceptance: No duplicate `aggregator_transaction_id` rows remain after backfill; backfill script idempotent.

### 3.4 Structured logging & timings

- 3.4.1 Add perf spans to sync pipeline

  - Instrument fetch, map, and upsert phases with `src/lib/perf.ts` helper and emit counts/timings as structured logs.
  - Acceptance: Each sync run emits logs with phase durations and record counts; logs contain `requestId`.

- 3.4.2 Add retry/error logs with context
  - Ensure errors include minimal context (item_id, counts, phase) and are captured by Sentry with request correlation.
  - Acceptance: Errors in tests are captured by Sentry mock and include the correlation id.

### 3.5 Extract transactions clean/mapping pipeline

- 3.5.1 Create `src/lib/transactions/clean.ts`

  - Implement normalization: date parsing, amount normalization (minor units), merchant name normalization, category mapping.
  - Acceptance: Normalized transactions pass unit tests for edge cases (missing fields, inconsistent dates).

- 3.5.2 Create `src/lib/transactions/mapping.ts`

  - Implement merchant and category mapping functions that use in-memory caches where possible.
  - Acceptance: Mapping returns consistent merchant ids and categories; cache hits reduce DB lookups.

- 3.5.3 Refactor route and service callers to use pipeline
  - Replace inline mapping logic with `clean -> mapping -> bulk` pipeline calls.
  - Acceptance: Handler code simplified; unit tests validate pipeline integration.

### 3.6 Bulk persistence & concurrency limits

- 3.6.1 Implement chunked bulk upsert with transactions

  - Implement batched upsert with a configurable batch size and circuit-breaker for failures.
  - Acceptance: Batches are applied atomically per batch; failures retry with exponential backoff.

- 3.6.2 Add worker/concurrency limiter

  - Implement a small concurrency pool to limit parallel DB writes and external calls (configurable 4–8 workers).
  - Acceptance: Memory and DB load remain controlled under large sync runs.

- 3.6.3 Performance smoke tests
  - Add stress-smoke tests that run bulk sync with N rows and assert run-time and DB metrics remain within thresholds.
  - Acceptance: Bulk sync completes within target time windows during smoke tests.

---

## 4. Manual Refresh Endpoint Rework

4.1 Fire-and-forget endpoint

- Route: `/api/plaid/refresh-item` triggers `POST /transactions/refresh` only.
- Returns 202 immediately with `{ code: "accepted", message: "Refresh requested" }`.
- Acceptance: No direct sync; actual updates flow via webhook path.

  4.2 UI/back-end contract note

- Provide note (docstring or inline comment) that UI must throttle the button (e.g., 5 minutes) client-side.
- Acceptance: Endpoint remains stateless/idempotent; no server throttling for now.

### 4.1 Fire-and-forget endpoint

- 4.1.1 Create `src/lib/plaid/refresh.ts`

  - Implement `requestRefresh(itemId)` which validates item ownership, enqueues a lightweight refresh job (or posts to internal `/transactions/refresh` route), and returns a job id.
  - Acceptance: Function returns quickly and validates input; enqueued job contains `itemId`, `requestId`, and `requestedBy` metadata.

- 4.1.2 Implement API route `/api/plaid/refresh-item`

  - Implement route handler that: validates auth/ownership (using `src/lib/api/auth.ts`), calls `requestRefresh`, and returns HTTP 202 with `{ code: "accepted", message: "Refresh requested", jobId }`.
  - Acceptance: Route responds 202 immediately; no sync work performed synchronously.

- 4.1.3 Authorization & abuse protection

  - Ensure the route requires auth and that the calling principal owns `itemId` or is an admin. Add optional server-side rate limit hook (via `src/lib/api/rateLimit.ts`) but keep default behavior permissive for solo devs.
  - Acceptance: Unauthorized requests return 403; owners can request refresh; rate limit can be enabled via env.

- 4.1.4 Enqueue implementation & delivery guarantees

  - Provide two implementations behind an interface: `inProcessQueue.enqueue(job)` (dev) and `externalQueue.enqueue(job)` (production) with a feature-flag/environment switch.
  - Acceptance: Dev uses in-process queue; production path can be wired to existing job systems. Both expose sufficient metadata to trace job origin.

- 4.1.5 Unit & integration tests for refresh endpoint

  - Add unit tests for `requestRefresh` (auth checks, invalid item, success) and integration tests that hit `/api/plaid/refresh-item` and assert 202 and correct enqueue behavior.
  - Acceptance: Tests cover happy path and auth failure; integration asserts no sync work performed synchronously.

### 4.2 UI/back-end contract & throttling guidance

- 4.2.1 Document client contract

  - Add a docstring in the route and an entry in `docs/` explaining that the UI must debounce/throttle refresh requests (recommended 5 minutes per item) and describe returned `jobId` semantics.
  - Acceptance: Documentation added to `docs/ManualRefresh.md` and the route docstring.

- 4.2.2 Client-side throttling examples

  - Add small example snippets for client (React) showing a debounced button with `useRef`/`localStorage` backoff and suggested UX messaging.
  - Acceptance: Examples included in `docs/ManualRefresh.md`.

- 4.2.3 Server-side optional safeguards (opt-in)

  - Provide an opt-in server-side safeguard using `src/lib/api/rateLimit.ts` or a short-lived `lastRequestedAt` column on `items` (configurable via env) that can be enabled in production for extra protection.
  - Acceptance: Safeguard is disabled by default; enabling it enforces minimal interval per item and returns 429 when hit.

- 4.2.4 Monitoring & observability

  - Emit a metric/event when refresh is requested (count by item_id, user_id, reason) and capture request id so it's traceable in logs and Sentry.
  - Acceptance: Metrics for refresh requests are emitted in dev mock and available when obs backend wired.

---

## 5. Balances On-Demand

5.1 Server function for balances

- Add `lib/plaid/accounts.getBalances(accessToken)` calling `POST /accounts/balance/get`.
- Acceptance: API controller fetches cached data first, then balances; no transactions sync on page load.

  5.2 Streaming/async update (optional)

- If supported in current stack, stream/push updated balances to the client; otherwise return in second call.
- Acceptance: Dashboard loads instantly from DB; balances update shortly after.

  5.3 Read route caching hints (where applicable)

- For cacheable reference GET routes (e.g., categories), add `export const revalidate = 3600` or Cache-Control with SWR.
- Explicitly mark dynamic endpoints (webhooks, sync) as `cache: 'no-store'` for clarity.
- Acceptance: Reference endpoints use caching hints; dynamic endpoints explicitly opt-out.

### 5.1 Server function for balances

- 5.1.1 Implement `src/lib/plaid/accounts.getBalances`

  - Implement `getBalances(accessToken)` that calls Plaid `POST /accounts/balance/get`, normalizes response to internal `Balance` shape, and returns per-account balances.
  - Acceptance: Function returns normalized balances and handles Plaid transient errors with retries and exponential backoff.

- 5.1.2 Add caching layer & cache-first controller

  - Use `src/lib/processing/caches.ts` to cache recent balances per `accountId`/`itemId` with short TTL (e.g., 60s). Implement `getBalancesCached(itemId)` controller that returns cached data if fresh, otherwise calls `getBalances` and updates cache.
  - Acceptance: Controllers return cached balances when available; no transactions sync triggered by balance reads.

- 5.1.3 Add API route `/api/plaid/balances` (server-only)

  - Implement authenticated route that accepts `itemId` or `accountId`, verifies ownership, returns cached balances (or fetches & caches then returns) and uses `revalidate` or Cache-Control hints as appropriate.
  - Acceptance: Route returns fast for cache hits and never triggers transaction sync; unauthorized access returns 403.

- 5.1.4 Unit & integration tests

  - Add unit tests for `getBalances` (happy path, transient Plaid errors, malformed responses), and integration tests for `/api/plaid/balances` verifying cache behavior and auth enforcement.
  - Acceptance: Tests cover caching, retry behavior, and error mapping to standardized error responses.

### 5.2 Streaming / async update (optional)

- 5.2.1 Evaluate push/stream options

  - Evaluate available stack options (Server-Sent Events, WebSocket, edge SSE, or background push via client subscription) and document chosen approach with trade-offs.
  - Acceptance: Decision noted in `docs/` with recommended implementation path.

- 5.2.2 Implement lightweight async update path (optional)

  - If chosen, implement `balancesUpdatePublisher.publish(itemId, balances)` that notifies interested clients (SSE or WebSocket) and a fallback notification path (e.g., client polls `GET /api/plaid/balances`).
  - Acceptance: When enabled, clients connected receive a balance update within a short window after refresh; functionality covered by integration tests where feasible.

### 5.3 Read route caching hints & client guidance

- 5.3.1 Add caching hints to reference routes

  - For cacheable GETs (categories, merchant lists), add `export const revalidate = 3600` or set Cache-Control headers and document expectations in `docs/`.
  - Acceptance: Reference endpoints include caching hints; dynamic endpoints explicitly opt-out via `cache: 'no-store'`.

- 5.3.2 Document client-side caching and UX expectations

  - Document recommended client behavior for balances (cache TTL, polling cadence, and fallback to manual refresh with backoff). Include example snippets for React + SWR or fetch-based polling.
  - Acceptance: Client guidance added to `docs/BalancesOnDemand.md` and referenced from the API route docstring.

- 5.3.3 Observability & metrics

  - Emit metrics for balance fetches (cache hit/miss, fetch latency, errors) and ensure traces include `requestId` and `itemId` (hashed) for correlation.
  - Acceptance: Metrics are emitted in dev mock and available when monitoring backend hooked up.

---

## 6. Standardized Error Handling

6.1 Error helper

- Introduce `withErrorHandling` wrapper for API handlers.
- Standard response shape: `{ code: string, message: string }`.
- Acceptance: All routes return standardized errors; no stack traces in responses.

  6.1.1 Downstream async coverage

- Ensure major downstream async calls (DB operations, Plaid calls) are wrapped or executed within guarded blocks to avoid unhandled rejections.
- Acceptance: No unhandled promise rejections in logs; routes fail fast with standardized errors.

  6.2 Error taxonomy

- Define stable codes: `validation_error`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `rate_limited`, `internal_error`.
- Acceptance: Codes used consistently; mapped to proper HTTP statuses.

  6.3 Non-sensitive error responses & redaction

- Return generic client messages; log detailed errors server-side only.
- Add redaction helpers to strip secrets/PII from logs; use env flag for verbose dev logging.
- Acceptance: No sensitive payloads in responses or production logs; dev verbosity controlled by env.

### 6.1 Error wrapper & common error classes

- 6.1.1 Create `src/lib/api/errors.ts`

  - Implement typed error classes (e.g., `ValidationError`, `UnauthorizedError`, `NotFoundError`, `ConflictError`, `RateLimitedError`, `InternalError`) that carry `code`, `httpStatus`, and optional `meta` fields.
  - Acceptance: Error classes are exported and used in at least one route/service unit test.

- 6.1.2 Implement `withErrorHandling(handler)` wrapper

  - Create `withErrorHandling` that wraps async route handlers, catches errors, maps known error classes to `code`/status, logs server-side detail (using redaction), sends standardized JSON responses, and captures exceptions to Sentry (or mock in dev).
  - Acceptance: All wrapped routes return `{ code, message }` and never expose stack traces; Sentry mock receives event in tests.

- 6.1.3 Refactor a few representative routes to use wrapper

  - Pick 2–3 critical routes (webhook, sync trigger, balances) and refactor to use `withErrorHandling` to validate behavior across sync and webhook paths.
  - Acceptance: Refactored routes pass existing tests and demonstrate standardized error responses.

### 6.2 Downstream coverage & retries

- 6.2.1 Wrap downstream calls with guarded helpers

  - Implement `safeCall(fn, context)` helper that executes downstream calls (DB queries, Plaid client) and converts common transient errors into retriable or mapped domain errors.
  - Acceptance: Transient network errors are retried according to config; permanent errors map to appropriate domain errors.

- 6.2.2 Add retry policies for outbound HTTP/DB ops

  - Use exponential backoff with capped retries for Plaid calls and optional retry for DB transient errors. Make retry behavior configurable via env.
  - Acceptance: Retry policy exercised in unit tests via simulated transient failures.

### 6.3 Error taxonomy & mapping

- 6.3.1 Define canonical error codes & mapping table

  - Create a mapping of error classes → `{ code, httpStatus }` in `src/lib/api/errors.ts` and used by `withErrorHandling` for final responses.
  - Acceptance: Mapping covers all error classes and a fallback to `internal_error`.

- 6.3.2 Create developer-facing docs for codes

  - Add `docs/ErrorTaxonomy.md` listing codes, descriptions, example response bodies, and guidance for when to use each code.
  - Acceptance: Docs added and referenced from CONTRIBUTING or API docs.

### 6.4 Non-sensitive responses & redaction

- 6.4.1 Implement `src/lib/logging/redact.ts`

  - Implement a redaction helper that strips/obfuscates fields (e.g., tokens, account numbers, secrets, PII) from objects before logging. Provide allowlist/denylist configuration and environment toggles for verbose dev logs.
  - Acceptance: Tests validate that sensitive fields are redacted in logs and that verbose dev mode can be enabled for richer logs.

- 6.4.2 Integrate redaction in `withErrorHandling` and logging

  - Ensure error logging uses `redact` before writing to logs and only include minimal metadata in responses (code + message). Stack traces logged only to Sentry/dev logs.
  - Acceptance: Production-mode logs do not include sensitive values; test logs show redaction applied.

### 6.5 Observability & Sentry integration

- 6.5.1 Create `src/lib/api/sentry.ts` init helper

  - Initialize Sentry client with DSN from env and provide a `captureException(err, context)` helper used in `withErrorHandling`.
  - Acceptance: Sentry init is modular and mocked in tests; errors captured with requestId and hashed user id.

- 6.5.2 Ensure correlation & context on events

  - Attach `requestId`, `route`, `userId` (hashed), and minimal meta to Sentry events and structured logs for traceability.
  - Acceptance: Sentry mock receives events with correlation fields in unit tests.

### 6.6 Tests & rollout strategy

- 6.6.1 Unit tests for error classes, mapping, redaction

  - Add unit tests for all error classes mapping and `redact` behavior.
  - Acceptance: Tests assert mapping table and redaction behavior.

- 6.6.2 Integration tests for `withErrorHandling`

  - Simulate routes throwing domain errors and unexpected exceptions; assert HTTP responses, logs (redacted), and that Sentry mock is invoked for internal errors.
  - Acceptance: Integration tests validate standard JSON response shape and that unexpected errors map to `internal_error` with 500.

- 6.6.3 Gradual rollout plan

  - Start by wrapping a small set of critical routes. Monitor errors and logs, then progressively wrap remaining routes. Use feature-flag or branch deployment to control rollout.
  - Acceptance: Rollout plan documented in `docs/ErrorHandlingRollout.md` with rollback steps and monitoring checklist.

---

## 7. Observability

7.0 Middleware for request IDs and (optional) rate limiting

- Add `src/middleware.ts` to set `x-request-id` on all `/api/*` requests and wire basic rate limiting for hot endpoints (e.g., webhooks) if needed.
- Acceptance: Request IDs appear in logs; rate limiting can be toggled or omitted for solo dev.

  7.1 Structured logging

- Implement JSON logs in production with request IDs (`x-request-id`).
- Acceptance: Every log line includes `requestId`, `route`, and `phase` where applicable.

  - Performance spans logged with counts and durations (no payload bodies).

    7.2 Error monitoring

- Add Sentry (or equivalent) init module and capture errors in `withErrorHandling` and webhook/sync services.
- Acceptance: Errors surface in monitoring with stack and request context.

  7.2.1 Correlation & context

  - Include request id, user id (hashed), and route context in error events.
  - Acceptance: Sentry (or equivalent) events are correlated to logs and requests for traceability.

### 7.0 Request middleware & rate limiting

- 7.0.1 Implement `src/middleware.ts`

  - Middleware responsibilities: set `x-request-id` (UUIDv4) for every `/api/*` request, attach `requestId` to the request/context, and make it available to logging and Sentry.
  - Acceptance: Middleware sets `x-request-id` for requests missing one and exposes it to downstream handlers.

- 7.0.2 Implement optional rate limiter hook

  - Add lightweight rate limiter that can be configured per-route via `routeOptions.rateLimit` and toggled with env. Use in-memory token-bucket for dev and provide an interface for a Redis-backed limiter for production.
  - Acceptance: Rate limiter returns 429 with `{ code: "rate_limited", message }` when throttled and can be toggled off in dev.

### 7.1 Structured logging & perf spans

- 7.1.1 Add `src/lib/logging/logger.ts` JSON logger

  - Implement structured JSON logger that always includes `timestamp`, `level`, `requestId`, `route`, and `phase`. Provide `logger.child({})` semantics for contextual logs and ensure production-level formatting.
  - Acceptance: Logger outputs valid JSON lines and is used across refactored modules.

- 7.1.2 Integrate perf spans & timing helper

  - Extend `src/lib/perf.ts` to provide `span(name)` and `measure(phase, fn)` helpers that record start/end times, counts, and durations. Attach `requestId` and `route` to spans and log them via `logger` (no payload bodies).
  - Acceptance: Each sync run emits spans for `fetch`, `map`, `bulkUpsert` with counts and durations.

- 7.1.3 Sampling & log volume control

  - Implement sampling/config for verbose traces to avoid log overload in production; allow `LOG_SAMPLING_RATE` env to control fraction of requests fully instrumented.
  - Acceptance: Sampling reduces log volume; tests demonstrate sampling logic.

### 7.2 Metrics, dashboards & alerts

- 7.2.1 Instrument metrics for key events

  - Emit metrics for: webhook verification failures, webhook duplicates, refresh requests, balance fetch (hit/miss), sync durations, batch sizes, upsert errors, and rate-limited events. Expose metrics via Prometheus-compatible `/metrics` endpoint or a mock metrics collector.
  - Acceptance: Metrics emitted in dev mock; `/metrics` exposes counters/gauges/histograms.

- 7.2.2 Create Grafana dashboard templates

  - Provide JSON templates showing key charts: sync throughput, sync latency histogram, error rate, webhook duplicate rate, and queue depth (if using external queue). Document alert thresholds and runbook links.
  - Acceptance: Dashboard templates added to `observability/` and referenced in ops docs.

- 7.2.3 Alerts & runbooks

  - Define basic alerts: high webhook verification failures, high change-failure rate, sustained high sync latency, and rate-limit spikes. Include runbook links and escalation steps in `docs/ObservabilityRunbook.md`.
  - Acceptance: Alerts defined and runbooks present in docs.

### 7.3 Sentry & error correlation

- 7.3.1 Sentry init & integrations

  - Implement `src/lib/api/sentry.ts` with configuration for DSN, environment, and traces sampling rate. Integrate with `withErrorHandling`, middleware (to attach `requestId`), and perf spans where applicable.
  - Acceptance: Sentry events include `requestId`, `route`, and hashed `userId`; traces are linked to spans when sampling enabled.

- 7.3.2 Breadcrumbs & context enrichment

  - Emit breadcrumbs for significant lifecycle events (webhook received, enqueue job, bulk upsert start/finish) to Sentry to aid root-cause analysis.
  - Acceptance: Breadcrumbs appear on Sentry events in mocked tests.

### 7.4 Tests & verification

- 7.4.1 Unit tests for middleware, logger, perf helpers

  - Add unit tests asserting `x-request-id` behavior, logger JSON format, `span` measurements, and sampling behavior.
  - Acceptance: Unit tests cover edge cases and environment toggles.

- 7.4.2 Integration tests for observability flows

  - Integration tests verify that flows (webhook -> enqueue -> sync) produce logs, spans, and metrics; Sentry mock receives errors with expected context and breadcrumbs.
  - Acceptance: Integration test asserts correlation between generated logs, metrics, and Sentry events.

### 7.5 Docs & runbooks

- 7.5.1 Observability docs

  - Add `docs/Observability.md` describing middleware behavior, logging format, metrics exposed, dashboards, and links to runbooks.
  - Acceptance: Docs provide clear instructions for onboarding and troubleshooting.

- 7.5.2 Ops runbook

  - Create `docs/ObservabilityRunbook.md` with incident response steps, common troubleshooting commands, and mitigation steps (e.g., toggling sampling, enabling rate limiter, scaling DB/queue).
  - Acceptance: Runbook includes clear steps and contact points for escalation.

---

## 8. Maintenance Code Paths (Dev Only)

- Implement module/function to scan items inactive > 90 days and probe with `POST /accounts/balance/get`.
- On `ITEM_LOGIN_REQUIRED`, set item `status = disconnected`.
- Acceptance: Function is unit-tested; actual scheduling left out of scope (ops).

### 8.1 Maintenance scanner design

- 8.1.1 Create `src/lib/maintenance/scanItems.ts`

  - Implement `scanInactiveItems({thresholdDays = 90, limit = 1000})` that finds items with `last_activity_at` older than threshold and triggers a probe via Plaid `POST /accounts/balance/get` or `auth` as appropriate. The function should be idempotent and resumable.
  - Acceptance: Function returns report of items probed and results (status, error codes) and supports `dryRun: true`.

- 8.1.2 Probe implementation & error handling

  - Implement `probeItem(item)` that calls Plaid and maps responses: `OK`, `ITEM_LOGIN_REQUIRED`, transient errors, etc. Use `safeCall`/retry policy from WBS section 6.
  - Acceptance: `ITEM_LOGIN_REQUIRED` is flagged; transient errors are retried; final result normalized.

- 8.1.3 Status update & audit trail

  - On `ITEM_LOGIN_REQUIRED`, update `items.status = 'disconnected'` and insert an audit row `item_status_changes` recording `previous_status`, `new_status`, `reason`, `requestId`, and `actor = maintenance_scanner`.
  - Acceptance: Audit rows created for any status change; updates are wrapped in a transaction.

- 8.1.4 Dev vs production behavior & toggles

  - Provide an interface to run in `dryRun` or `apply` mode. Default to `dryRun` when `NODE_ENV=development`. Allow per-run overrides and logging levels.
  - Acceptance: Dry runs produce reports and do not alter DB state.

- 8.1.5 Unit & integration tests

  - Unit test `probeItem` handling of Plaid responses and error mapping. Integration test that runs `scanInactiveItems` against a test DB and asserts expected audit rows and status updates when `apply=true`.
  - Acceptance: Tests run in CI with an in-memory or test database.

### 8.2 Operational notes

- 8.2.1 Scheduling & orchestration (ops)

  - Document scheduling options in `docs/Maintenance.md` (cron, Kubernetes cronjobs, or external scheduler). Recommend a conservative schedule (weekly) and low concurrency.
  - Acceptance: Ops doc provides guidance; actual scheduling left to infra.

- 8.2.2 Safety & rate limiting

  - Provide rate-limited probes per item and respect Plaid rate limits. Implement exponential backoff on repeated failures and circuit-breaker for bulk failures.
  - Acceptance: Scanner honors rate limits in tests and logs when throttled.

## 9. Data Model & SQL Migrations

- Unique constraint on `aggregator_transaction_id` (or equivalent) in `transactions` table.
- Indexes for frequent lookups and hot paths:
  - `(user_id, date DESC)` and `(user_id, category_id, date DESC)`
  - `(aggregator_transaction_id)` unique index
  - `(aggregator_account_id)` unique index on `accounts`
  - `(merchants.name_normalized)` regular index
  - Optional: GIN index on `transactions.user_metadata` if queried
- Add `status` field to `items` if missing, enum includes `disconnected`.
- Acceptance: Migrations apply cleanly; rollback scripts included.

- Table for webhook events: unique `(event_id, item_id)` and processed timestamp.
- Acceptance: Verified duplicate webhook deliveries are ignored in tests.

### 9.1 Migration plan & tooling

- 9.1.1 Migration framework selection

  - Use existing project migration tooling (e.g., `knex`, `node-pg-migrate`, or raw SQL migrations) consistent with repo. Create migration files under `sql/migrations/` with up/down SQL.
  - Acceptance: Migration files follow repo conventions and are discoverable by CI.

- 9.1.2 Migration: add unique constraint on `aggregator_transaction_id`

  - Add `001_add_unique_aggregator_transaction_id.sql` that creates unique index on `transactions(aggregator_transaction_id)` with `CONCURRENTLY` where supported, and the matching rollback to drop index.
  - Acceptance: Migration applies on empty test DB and rollback succeeds.

- 9.1.3 Migration: add indexes for hot paths

  - Add migration to create indexes: `(user_id, date DESC)`, `(user_id, category_id, date DESC)`, `(aggregator_account_id)` on `accounts`, and `(merchants.name_normalized)`.
  - Acceptance: Index creation validated in test environment and explain plans show index usage for representative queries.

- 9.1.4 Migration: items.status field

  - Add `items.status` enum column with default `active` and allowed values including `disconnected`. Provide a backfill step to mark items with recent failures if known.
  - Acceptance: Column added; backfill script is idempotent and included in migration steps when needed.

- 9.1.5 Migration: webhook events table

  - Create `webhook_events` table with fields: `id SERIAL`, `event_id TEXT`, `item_id UUID`, `payload JSONB`, `received_at TIMESTAMP`, `processed_at TIMESTAMP NULL`, `status TEXT`, and unique constraint on `(event_id, item_id)`; add index on `processed_at`.
  - Acceptance: Duplicate inserts fail gracefully and code uses `ON CONFLICT DO NOTHING` where appropriate.

### 9.2 Backfill & data remediation

- 9.2.1 Backfill duplicates remediation

  - Implement `scripts/backfill_deduplicate_transactions.sql` or JS backfill that identifies duplicate `aggregator_transaction_id` rows, chooses canonical row (e.g., latest `updated_at`), updates foreign keys, and marks duplicates for archival.
  - Acceptance: Backfill script is idempotent and includes a dry-run mode.

- 9.2.2 Backfill for items.status

  - Provide a script that marks items with recent `ITEM_LOGIN_REQUIRED` or other failure signals as `disconnected` if criteria met, with dry-run and audit logging.
  - Acceptance: Backfill reviewed and applied in staging before prod.

### 9.3 CI validation & rollback

- 9.3.1 Add migrations to CI pipeline

  - Ensure CI runs migrations against a fresh test DB and validates schema constraints and sample query plans.
  - Acceptance: CI fails if migrations error or explain plans show regressions.

- 9.3.2 Provide rollback & recovery scripts

  - Include `down` migration scripts and a documented rollback plan in `docs/Migrations.md` with steps to revert schema and re-run backfills if needed.
  - Acceptance: Rollback tested on staging.

### 9.4 Smoke & performance testing

- 9.4.1 Performance validation for new indexes

  - Run smoke performance tests that verify query latency improves for representative endpoints (e.g., recent transactions by user) and that index creation does not regress writes excessively.
  - Acceptance: Performance test results recorded and acceptable thresholds documented.

- 9.4.2 Run migration in maintenance window simulation

  - Create a checklist for applying heavy index changes (CONCURRENTLY vs lock considerations) and simulate on staging with production-like data.
  - Acceptance: Checklist validated and documented in `docs/Migrations.md`.

---

## 10. Tests

10.1 Unit tests

- Error helper: standardized responses and status codes.
- Performance helpers: caches (hits/misses), timing helper sanity.
- Clean/mapping: chunked persistence (batching), dedupe by unique constraint.
- Error paths: downstream DB/HTTP failures wrapped by `withErrorHandling`; redaction applied.
- Acceptance: Coverage over critical paths; happy path + 1–2 edge cases per module.

- Webhook handler (verified vs unverified, duplicate events).
- Sync endpoint call path (service mocked Plaid client).
- Manual refresh endpoint (returns 202, does not sync).
- Read endpoints (if any) respect caching hints; dynamic endpoints are no-store.
- Observability: request id present in logs, Sentry capture invoked on forced error.

---

11.1 Developer docs

- Update `docs/` to reflect new routes, service boundaries, and error codes.
- Acceptance: `Plaid_Workflow_Ideal.md` remains the reference; `Current` doc updated to reflect migration status.

- Delete or disable code paths that trigger sync on non-`SYNC_UPDATES_AVAILABLE` webhooks.
  11.3 Remove proxy-to-Supabase routes

- For routes that simply proxy to Supabase, migrate consumers to direct Supabase access under RLS and remove the routes.

---
