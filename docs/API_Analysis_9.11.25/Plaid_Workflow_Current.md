# Plaid Personal Finance App - Current Engineering Workflow & API Orchestration

This document mirrors the structure of `Plaid_Workflow.md` and describes how the system currently operates. It is intended to clarify present behavior so we can align with the ideal, cost-minimizing workflow.

---

## 1. Core Tenets (As Implemented Today)

1. Our Database Is the Primary Read Path (with caveats):

   - Most user-facing data (transactions, accounts) is read from Supabase tables.
   - Some processing (sync/clean) is performed via Next.js API routes that then write back to Supabase.

2. Syncing Is Webhook-Triggered (plus additional triggers):

   - Webhooks are received at `/api/aggregator/webhook`. Multiple Plaid webhook codes are handled (INITIAL_UPDATE, HISTORICAL_UPDATE, DEFAULT_UPDATE, SYNC_UPDATES_AVAILABLE).
   - Each relevant webhook can trigger a sync call path that invokes our internal `/api/aggregator/plaid/transactions/sync` endpoint.

3. Static Data (Accounts) Is Pulled at Link Time (generally once):

   - During link, the accounts are retrieved and stored. Follow-up reads primarily come from the DB.

4. Balances Are Fetched On Demand (limited):
   - Balance refresh is not systematically documented here; in practice, balances are read from the DB for UI and fetched ad hoc when needed by features.

---

### 2. Phase 1: Onboarding - New Item Connection (Current)

#### Step 1: User Initiates Bank Connection

- Frontend: Launches a link flow via our Next.js routes under `/api/aggregator/plaid/create_link_token`.
- The institution pre-selection may not always be passed (depends on current UI path).

#### Step 2: Plaid Link → Token Exchange

- After Link success, backend exchanges `public_token` for `access_token` and `item_id` via `/api/aggregator/plaid/exchange_public_token`.
- DB: We persist item linkage and store the (encrypted) access token and item ID under `account_links`/`items` tables (naming differs across code paths).

#### Step 3: Initial Data Pull

- Accounts: Retrieved and stored (one-time for static metadata).
- Transactions: Initial sync path uses `/api/aggregator/plaid/transactions/sync` which calls Plaid `/transactions/sync` until `has_more` = false.
- Cursor: We persist a cursor on the account/item link record when provided by `/transactions/sync`.

---

### 3. Phase 2: Core App Experience - Daily Use & Data Sync (Current)

#### User Dashboard Load

- Frontend queries our API routes or directly Supabase for cached transactions and accounts.
- UI renders from DB results; live Plaid calls are not performed directly by the UI.

#### Webhook-Driven Sync

- Trigger: Plaid sends webhooks (TRANSACTIONS.\* including SYNC_UPDATES_AVAILABLE) to `/api/aggregator/webhook` (or legacy `/plaid/webhook` forwarded internally).
- Handler: Logs event, optionally stores an event record, and triggers `/api/aggregator/plaid/transactions/sync` with the current cursor from `account_links`.
- Sync Endpoint: Calls Plaid `/transactions/sync`, processes `added/modified/removed`, updates cursor, and may recursively continue if `has_more`.

#### Manual Refresh

- A specific UI “Refresh” button is not fully standardized in this code path. If present, the preferred model is to fire a lightweight request and rely on webhook completion, but current routes sometimes directly call sync.

---

### 4. Phase 3: System Maintenance (Current)

#### Stale Item Handling

- There is not yet a documented scheduled job in this repository that prunes stale items systematically.
- Item health is primarily inferred from webhook success/failure and sync outcomes.

---

### 5. Deviations from the Ideal Workflow

1. Multiple Webhook Codes → Multiple Syncs:

   - Current webhook handler triggers sync for several TRANSACTIONS webhook codes (INITIAL/HISTORICAL/DEFAULT/Sync Updates). This can duplicate work and cost.

2. Cursor & Idempotency:

   - Cursor is used, but dedupe/idempotency protections per event are not strictly enforced (risk of double processing on retries).

3. Manual Refresh Path:

   - In the ideal flow, `/transactions/refresh` is used as a fire-and-forget to trigger webhook-driven updates. Current implementation sometimes calls sync directly.

4. Verification & Security:

   - Webhook signature verification is not fully implemented (per Security Audit), which may allow unverified traffic to trigger syncs.

5. Maintenance Jobs:
   - Scheduled pruning for stale/disconnected items (e.g., `ITEM_LOGIN_REQUIRED`) is not set up as a recurring background process in this repo.

---

### 6. Immediate Alignment Tasks

- Limit sync triggers to `SYNC_UPDATES_AVAILABLE` and initial onboarding phases; avoid redundant full syncs on DEFAULT/HISTORICAL where not needed.
- Enforce webhook signature/JWS verification and add idempotency keys per item/event to prevent replay.
- Standardize the manual refresh endpoint as fire-and-forget (`/transactions/refresh`) and decouple from direct sync.
- Add a maintenance job or scheduled function to prune stale items and set `status = disconnected` when appropriate.
- Ensure cursor persistence and recursive sync continuation are robust and monitored with structured logs.

---

### 7. Data Flow Summary (Current)

- Write Path: Webhook → `/api/aggregator/webhook` → lookup item/access_token/cursor → `/api/aggregator/plaid/transactions/sync` → Plaid `/transactions/sync` → upsert `added/modified/removed` → update cursor.
- Read Path: UI → Supabase (transactions/accounts) → present cached data; balances/other live calls made selectively by server.

---

### 8. Notes & Assumptions

- Naming variations like `items` vs `account_links` refer to the same conceptual mapping (Plaid item ↔ user/account linkage) across different parts of the codebase.
- Balance-refresh specifics are evolving; current system favors cached reads with occasional live fetches.
- This document focuses on the orchestrations present in the Next.js API routes; Python backend (AI services) interacts with DB but is not the primary Plaid orchestration layer.

---

### 9. Ideal vs Current (Quick Comparison)

| Area                 | Ideal (Plaid_Workflow.md)                                                  | Current (This Doc)                                    | Impact                                        |
| -------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------- |
| Source of Truth      | DB serves all user-facing data; Plaid only updates DB                      | Mostly true; occasional processing embedded in routes | OK, but keep heavy logic server-side services |
| Sync Trigger         | Exclusively `SYNC_UPDATES_AVAILABLE` + initial onboarding                  | Multiple TRANSACTIONS webhook codes can trigger sync  | Risk of duplicate work/cost                   |
| Initial Static Data  | `/accounts/get` once at link; cached indefinitely                          | Implemented generally once                            | Aligned                                       |
| Transactions Update  | `/transactions/sync` with cursor; loop until `has_more` false; save cursor | Implemented; cursor saved; retries can re-trigger     | Needs idempotency guards                      |
| Balances             | Fetched on demand (dashboard), not polled                                  | Partially on demand                                   | Aligned with room for clarity                 |
| Manual Refresh       | Fire-and-forget `/transactions/refresh`; actual data via webhook           | Sometimes direct sync call                            | Extra cost and coupling                       |
| Webhook Verification | Enforced signature/JWS verification                                        | Not fully implemented                                 | Security + replay risk                        |
| Idempotency          | Per-item/event idempotency keys, dedupe                                    | Not strictly enforced                                 | Duplicate processing on retries               |
| Maintenance          | Scheduled prune of stale items; mark disconnected                          | Not scheduled in repo                                 | Avoidable costs remain                        |
| Observability        | Structured logs; timings for fetch/map/upsert                              | Basic logging; no timings                             | Harder to optimize                            |

---

### 10. Actionable Task Checklist (Linked to Comparison)

Use this checklist to track alignment work. Each task links to the relevant row in the comparison above.

- [ ] Source of Truth: extract heavy processing from route handlers into `src/lib` services (no client exposure). [See row][cmp-source-of-truth]
- [ ] Sync Trigger: restrict sync to `SYNC_UPDATES_AVAILABLE` (and initial onboarding) only. Remove redundant triggers for `DEFAULT_UPDATE`/`HISTORICAL_UPDATE`. [See row][cmp-sync-trigger]
- [ ] Transactions Update: enforce idempotency — per-item/event dedupe key, cursor-based guard, and unique constraint on `aggregator_transaction_id`. [See row][cmp-transactions-update]
- [ ] Manual Refresh: expose a fire-and-forget `/transactions/refresh` that returns immediately; let webhook drive data updates. [See row][cmp-manual-refresh]
- [ ] Webhook Verification: implement Plaid JWS/signature verification and reject unverified requests. [See row][cmp-webhook-verification]
- [ ] Idempotency: add event idempotency table/keys; skip processing when duplicate delivery detected. [See row][cmp-idempotency]
- [ ] Maintenance: schedule a weekly job to prune stale/disconnected items and mark `status = disconnected`. [See row][cmp-maintenance]
- [ ] Balances: document and standardize on-demand balance fetch behavior (no polling), with clear UI data freshness. [See row][cmp-balances]
- [ ] Observability: add structured logs and timings (fetch/map/upsert), plus request IDs via middleware. [See row][cmp-observability]
- [ ] Initial Static Data: verify `/accounts/get` is only called once per item at link time. [See row][cmp-initial-static-data]

### Anchor Targets for Comparison Rows

[cmp-source-of-truth]: #1-core-tenets-as-implemented-today
[cmp-sync-trigger]: #5-deviations-from-the-ideal-workflow
[cmp-initial-static-data]: #5-deviations-from-the-ideal-workflow
[cmp-transactions-update]: #5-deviations-from-the-ideal-workflow
[cmp-manual-refresh]: #5-deviations-from-the-ideal-workflow
[cmp-webhook-verification]: #5-deviations-from-the-ideal-workflow
[cmp-idempotency]: #5-deviations-from-the-ideal-workflow
[cmp-maintenance]: #5-deviations-from-the-ideal-workflow
[cmp-balances]: #5-deviations-from-the-ideal-workflow
[cmp-observability]: #5-deviations-from-the-ideal-workflow
