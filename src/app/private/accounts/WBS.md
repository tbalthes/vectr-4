# Accounts Page — Work Breakdown Structure (WBS)

Last updated: 2025-09-02

> Update 2025-09-02 (Audit + Plaid/MX Readiness): Added a complete project audit, schema alignment notes, and a step-by-step Plaid/MX integration plan with database changes, secure API routes, webhook processing, and data sync pipeline. See sections: Project Audit, Gaps & Refactors, and Plaid/MX Integration Plan.

## Overview

Build a production-ready Accounts page for the personal finance app. The page will list linked accounts, show balances, simple metrics (net worth / total assets / total debt), and allow drill-in to account details. This WBS covers frontend, backend API wiring, authentication, data models, caching, testing, and future-proofing for Plaid/MX integrations.

Assumptions:

- Single developer (you) + ChatGPT as assistant.
- No existing third-party account aggregator configured yet (Plaid/MX will be prepared for future integration).
- Project uses Next.js (app router), Supabase backend (auth + DB) and Tailwind/Shadcn UI components.

Goals:

- Implement a responsive Accounts landing page (cards/grid) matching the current design.
- Provide backend API endpoints to fetch accounts, balances, and recent activity.
- Secure endpoints behind authentication and RLS (Supabase) where applicable.
- Implement stable client-side caching and graceful loading states.
- Prep the data model and secure server flows for future Plaid/MX linking.

Stakeholders:

- Product owner / Developer (you)
- Users (end-users of the app)

Deliverables:

- `src/app/private/accounts/page.tsx` — Accounts landing page UI
- Backend API routes or supabase queries to list accounts, fetch balances, and recent transactions
- DB schema definitions (SQL or supabase migrations) for accounts, institutions, balances, transactions
- Auth gating and RLS policy checklist
- Tests (unit + integration smoke tests)
- Documentation and `README` describing how to wire a third-party aggregator

---

## Project Audit (current state)

Sources reviewed (grep): frontend hooks (`useAccounts`, analytics aggregator), API routes (`/api/analytics/aggregator`), Supabase helpers, Python FastAPI (transactions, user rules), and docs under `python/docs/system`.

Findings:

- Frontend
  - Next.js App Router is in use; Auth via `@supabase/auth-helpers-nextjs` and a working `useAuth` hook.
  - `useAccounts` exists and directly queries Supabase table `accounts` for the current user; basic list support is present but not yet integrated with a polished Accounts page UI.
  - No Plaid/MX Link UI or aggregator actions are implemented yet.
- Backend (Next.js + FastAPI)
  - A robust Analytics Aggregator pipeline exists (internal analytics endpoints & SQL RPC), but this is separate from external bank aggregators.
  - FastAPI app implements transactions-related features (upload, retroactive rules) and relies on Supabase as the database.
  - No Plaid/MX server-side endpoints found for link token exchange or webhooks.
- Database
  - Existing tables: `accounts`, `transactions`, categories, merchants, tags, etc.
  - Docs reference `plaid_access_token` and `categories_plaid` mapping; however, secure token storage and linkage tables are not fully defined here in the app repo.
  - Provided `schema.json` shows relationships across core finance tables but no explicit aggregator linkage tables; we’ll add: `institutions`, `account_links`, aggregator IDs on accounts/transactions, and webhooks log.

Conclusion: The app is ready to layer on an aggregator integration with modest refactors: add linkage tables, secure routes for token exchange, webhooks ingestion, and a sync pipeline to populate accounts/balances/transactions.

---

## Gaps & Required Refactors

1. Database alignment and new tables/columns

- Add tables:
  - `institutions(id, provider, name, logo_url, created_at)`
  - `account_links(id, user_id, provider, item_id, access_token_encrypted, status, last_synced_at, created_at, updated_at)`
  - `webhook_events(id, provider, event_type, payload_json, received_at, processed_at, status, error)`
- Add columns:
  - `accounts.provider` (enum: plaid|mx|manual|null)
  - `accounts.aggregator_account_id` (string)
  - `transactions.aggregator_transaction_id` (string)
  - Indexes and unique constraints:
    - Unique per user: (`user_id`, `aggregator_transaction_id`) to dedupe
    - Foreign keys from `accounts.institution_id` to `institutions.id`
- Mapping tables (optional now, used later):
  - `categories_plaid(category_id, plaid_category_id, plaid_hierarchy[])`
  - `categories_mx(category_id, mx_category_guid)`

2. Security, auth, secrets

- Introduce server-only env vars: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`; and for MX: `MX_CLIENT_ID`, `MX_API_KEY`.
- Store access tokens only server-side (encrypted) in `account_links.access_token_encrypted`.
- Enforce RLS on all user-owned rows and ensure server routes use a service role where necessary.

3. API routes (Next.js App Router)

- Add server routes:
  - POST `/api/aggregator/plaid/create_link_token`
  - POST `/api/aggregator/plaid/exchange_public_token`
  - POST `/api/aggregator/webhook` (shared handler; branch by provider)
  - GET `/api/accounts` (server endpoint that joins accounts, balances, institutions)
- Standardize response shapes for frontend consumption.

4. Sync pipeline

- After token exchange: queue initial fetch (accounts, balances, 90–365d of transactions) and persist.
- Webhook ingestion: upsert deltas for transactions, balances; set `last_synced_at`.
- Idempotency and retries: store webhook event ids; process safely.

5. Frontend UI/UX

- Add Accounts page components (grid/cards) and a Link Accounts button (hidden if already linked or behind a collapsible manage section).
- Link flow: open Plaid Link (or MX) using link token from server; onSuccess calls exchange endpoint; show progress and refresh account list.

6. Observability

- Add server logs for webhook processing; optional table `sync_runs` for metrics.

---

## Plaid/MX Integration Plan (detailed)

Design choices:

- Start with Plaid; abstract via `provider` in DB to allow MX later.
- Use Next.js server routes to host Plaid token exchange and webhooks; FastAPI remains for transaction business logic.

Database changes (SQL outline):

- Create `institutions`, `account_links`, `webhook_events` tables.
- Alter `accounts` to add: `provider`, `aggregator_account_id`, `institution_id` (fk), `last_synced_at`.
- Alter `transactions` to add: `aggregator_transaction_id`, indexed and unique per user.
- Add/confirm RLS on all user-owned tables; `account_links` rows tied to `user_id`.

Server routes (Plaid):

- POST `/api/aggregator/plaid/create_link_token`
  - Auth required; returns `{ link_token }` from Plaid
- POST `/api/aggregator/plaid/exchange_public_token`
  - Auth required; exchanges `public_token` → `access_token`, `item_id`; store encrypted token in `account_links`
  - Trigger background sync
- POST `/api/aggregator/webhook`
  - Verifies provider signature (Plaid webhook verification optional); enqueue processing; upsert deltas

Sync workers (in-route for MVP):

- Initial sync: fetch `/accounts/balance/get`, `/transactions/sync` until cursor caught up; persist with idempotency.
- Incremental sync: on webhook, continue `/transactions/sync` with stored cursor in `account_links`.

Frontend flow:

- Button “Connect Account” → calls create_link_token → opens Plaid Link → success posts public_token → show progress toast → refresh accounts.

Security & secrets:

- `.env.local` for client env vars; server-only secrets in deployment env/secret store. Never expose access tokens to the client.

Acceptance:

- User can link via Plaid; accounts appear with balances; transactions populate; subsequent webhooks update data.

---

## Use Case Descriptions for Plaid Data

To comply with Plaid's requirements for launching Link in Production in the US or Canada, the following use case descriptions outline how end-user data shared via Plaid will be used:

1. **Account Linking and Management**

   - Data such as account names, balances, and transaction histories will be used to provide users with a consolidated view of their financial accounts within the app.
   - This includes displaying account details, recent transactions, and aggregated financial metrics like net worth, total assets, and total debt.

2. **Transaction Categorization and Insights**

   - Transaction data will be categorized to help users understand their spending patterns and financial habits.
   - Insights derived from this data will be used to generate reports and visualizations for better financial planning.

3. **Budgeting and Financial Planning**

   - Users can set budgets and track their progress using the financial data retrieved via Plaid.
   - Historical transaction data will be analyzed to provide personalized recommendations and alerts.

4. **Fraud Detection and Security**

   - Transaction data will be monitored for unusual activity to help detect potential fraud.
   - Alerts will be sent to users in case of suspicious transactions.

5. **Data Sync and Updates**

   - Plaid data will be used to keep account balances and transaction histories up-to-date, ensuring users have access to the latest financial information.

6. **Third-Party Integrations**
   - With user consent, financial data may be shared with third-party services for additional features such as tax preparation or investment analysis.

All data usage will comply with applicable data privacy laws, and user consent will be obtained before accessing or sharing their financial data.

---

## Milestones

1. Project setup & design polish (local dev run, styling, components)
2. Data model & DB migrations (accounts, institutions, balances, transactions)
3. Auth + API skeleton (authenticated endpoints + supabase queries)
4. Accounts list UI + client wiring
5. Account details + recent activity
6. Caching, error handling, and tests
7. Plaid/MX integration prep (server-side wiring, webhooks, secrets management)
8. Final QA & documentation

---

## Detailed Task Breakdown

NOTE: owner is "You" unless noted. "ChatGPT" assists with code snippets, CI configs, and review.

### 1. Foundation (1 day)

- Task 1.1: Confirm dev environment and build scripts (node, pnpm/npm, eslint, tailwind). (You)
  - Verify `npm run dev` / `.venv` FastAPI if needed.
- Task 1.2: Add a page scaffold `src/app/private/accounts/page.tsx` if missing. (You + ChatGPT)
- Task 1.3: Create `WBS.md` and baseline README for the feature. (Done)

Acceptance: local dev builds; baseline page renders without errors.

### 2. Data Model & Migrations (1–2 days)

- Task 2.1: Design DB tables (Postgres): `institutions`, `accounts`, `balances`, `transactions`, `account_links`.
  - accounts: id (pk), user_id (fk), institution_id (fk), name, mask, type, currency, last_synced_at, active
  - balances: id, account_id, balance_amount, available, as_of
  - transactions: id, account_id, posted_at, amount, merchant, category, raw
  - institutions: id, provider (plaid|mx|manual), name, metadata
  - account_links: stores link/session info for aggregator (encrypted tokens, status)
- Task 2.2: Create SQL migrations or supabase table definitions. (You)

Acceptance: Tables created locally or on Supabase; simple seed data available.

### 3. Auth & Security (0.5–1 day)

- Task 3.1: Confirm auth hook and context (`useAuth`) returns user id and session. (You)
- Task 3.2: Implement RLS policies for `accounts`, `balances`, `transactions` to allow row access only to owning `user_id`.
- Task 3.3: Secure any server-side endpoints to use service role for sensitive operations, and user-scope for queries.

Acceptance: Authenticated user can fetch only their rows; unauthenticated requests are rejected.

### 4. Backend APIs & Queries (1–2 days)

- Task 4.1: Implement supabase helper queries in `src/lib/supabase/` to list accounts and balances (e.g., `listAccountsQuery`, `getAccountDetailsQuery`). (You + ChatGPT)
- Task 4.2: Add API routes if needed (Edge/Next API routes or FastAPI endpoints) to handle linking flows, webhook verification, and server-side aggregation calls.
- Task 4.3: Implement pagination and server-side filtering by account type.

Acceptance: Endpoints return JSON matching the frontend contract and require authentication.

### 5. Frontend — Accounts Landing Page (2–3 days)

- Task 5.1: Implement `AccountsGrid` and `AccountCard` components using existing UI primitives.
  - Card shows: account name, masked number, available/current balance, last activity date, small badge for account type, and quick actions (Manage / Details).
- Task 5.2: Wire `listAccountsQuery` to the page with loading / empty / error states.
- Task 5.3: Add top-level summary cards: Net Worth, Total Assets, Total Debt; compute client-side or via backend aggregate query.
- Task 5.4: Ensure responsive layout: desktop grid vs stacked mobile layout; anchor sidebar spacing.

Acceptance: Page lists accounts, shows metrics, is responsive, and handles no-data cases.

### 6. Frontend — Account Details (1–2 days)

- Task 6.1: Create `AccountDetails` page/modal with balances, recent transactions (paginated), and actions (export, link/unlink).
- Task 6.2: Implement transactions list component with avatars/merchant, category chips, amount coloring, and click-to-view details.

Acceptance: User can open an account and see recent transactions and balance history.

### 7. Caching, Performance & UX polish (1 day)

- Task 7.1: Add client-side caching (SWR or React Query) for accounts and transactions with revalidation strategy.
- Task 7.2: Add skeleton loaders and optimistic UI for quick actions (delete/unlink).
- Task 7.3: Accessibility review (tab order, landmarks, aria labels). (You)

Acceptance: Fast perceived loading; offline-friendly revalidate flow.

### 8. Testing & QA (1–2 days)

- Task 8.1: Unit tests for helper queries and small components.
- Task 8.2: Integration smoke tests: render page with mocked supabase responses; verify UI states.
- Task 8.3: Manual QA across breakpoints and devices.

Acceptance: All tests pass locally; main flows manually verified.

### 9. Plaid / MX Integration Prep (2 days planning + later implementation)

- Task 9.1: Design server-side contract for link token creation and public token exchange. Create placeholder server endpoints:
  - POST /api/plaid/create_link_token
  - POST /api/plaid/exchange_public_token
  - POST /api/aggregator/webhook (for item updates)
- Task 9.2: Add `account_links` table for storing provider tokens (encrypted), and a secure process to rotate/revoke tokens.
- Task 9.3: Add secrets management guidance (use environment variables + secrets manager) and CI secret setup docs.
- Task 9.4: Document webhooks processing (idempotency, retries).

Acceptance: Endpoints + DB placeholders exist and documented; secrets flow documented.

### 10. Deployment & CI (0.5–1 day)

- Task 10.1: Add or update CI to run linters and tests for the accounts feature.
- Task 10.2: Smoke deploy to staging and verify API keys are not leaked.

Acceptance: CI checks pass; staging deploy shows accounts page working with seeded data.

---

## Risks & Mitigations

- PII / credential leaks: never store raw aggregator secrets in client. Always exchange tokens server-side and encrypt sensitive data at rest.
- RLS misconfiguration: test thoroughly with multiple user accounts.
- Rate limits from aggregator: implement backoff and webhook driven sync.

---

## Acceptance Criteria (feature-level)

- Authenticated users see only their accounts.
- Accounts page shows Net Worth, Total Assets, Total Debt computed correctly.
- Account list loads with skeletons and supports deep-link to details.
- Transactions load incrementally and paginate.
- Link/unlink flow prepared server-side and documented for future integration.

---

## Suggested File / API Contracts

- Frontend pages/components:
  - `src/app/private/accounts/page.tsx` (landing)
  - `src/components/accounts/AccountsGrid.tsx`
  - `src/components/accounts/AccountCard.tsx`
  - `src/components/accounts/AccountDetails.tsx`
- Backend helpers:
  - `src/lib/supabase/accounts-queries.ts`
  - API routes: `src/pages/api/aggregator/create_link_token.ts`, `exchange_token.ts`, `webhook.ts` (or `app/api/...` in app router)

Contract example - list accounts response:

```json
{
  "accounts": [
    {
      "id": "uuid",
      "name": "Checking",
      "mask": "1234",
      "type": "checking",
      "balance": 5420.32,
      "available": 5420.32,
      "currency": "USD",
      "last_activity": "2025-08-12T..."
    }
  ]
}
```

---

## Time estimates (rough)

- Foundation & scaffold: 1 day
- Data model & migrations: 1–2 days
- Auth & RLS: 0.5–1 day
- Backend queries/APIs: 1–2 days
- Frontend accounts page: 2–3 days
- Account details: 1–2 days
- Caching & UX polish: 1 day
- Testing & QA: 1–2 days
- Plaid/MX prep: 2 days (planning + placeholders)

Total: ~10–15 work days to deliver a solid MVP (depends on interruptions and iteration).

---

## Next immediate actions (this sprint)

1. Create DB migrations and seed a couple accounts (local). (You)
2. Implement `listAccountsQuery` and wire the accounts page to show seed data. (You + ChatGPT)
3. Add RLS draft policies to Supabase and test with two user accounts. (You)

If you want, I can start by creating the migration SQL and a `listAccountsQuery` file next — tell me which task to start on and I’ll implement it.
