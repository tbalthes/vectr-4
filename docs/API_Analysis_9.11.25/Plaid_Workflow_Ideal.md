# Plaid Personal Finance App - Engineering Workflow & API Orchestration

## 1. Core Tenets (The "How We Save Money" Principles)

This document outlines the precise API orchestration for the application. All implementation must adhere to the following principles to ensure a cost-effective and performant system.

1. **Our Database is the Source of Truth:** Plaid is treated as a service for *updating* our database. All user-facing data (accounts, transactions) is served directly from our local database cache for speed and to minimize API calls.
2. **Syncing is Webhook-Driven:** We do NOT poll Plaid for transaction updates. We will implement and rely on `SYNC_UPDATES_AVAILABLE` webhooks to notify us when fresh data is available. This is the single biggest cost-saving measure.
3. **Static Data is Fetched Once:** Data that rarely changes (account names, numbers) is fetched exactly once during the initial link and then cached indefinitely in our database.
4. **Balances are Fetched On-Demand:** Real-time balance data is fetched only when the user needs to see it (e.g., on dashboard load), not on a recurring timer.

---

## 2. Phase 1: Onboarding - New Item Connection

**Goal:** A new user links their financial institution for the first time. The process must be efficient, fetching all necessary static data in one pass.

### Step 1: User Initiates Bank Connection

* **Trigger:** User clicks "Connect a Bank Account."
* **[Frontend]:** Renders the bank selection UI.
* **ENGINEERING NOTE:** To reduce API calls, our UI should feature a static, cached grid of the Top 10 institutions alongside the dynamic search bar. This list can be refreshed by a background job weekly.

### Step 2: Institution Search & Selection

* **Trigger:** User types in the search bar.
* **[Frontend]:** Makes a debounced `POST` request to our backend endpoint `/api/plaid/search-institutions`.
* **[Backend]:**
  * `PLAID API CALL: POST /institutions/search`
  * **Parameters:** `{ query: "...", products: ["transactions"], country_codes: ["US"] }`
  * **Rationale:** Filtering by `products` ensures we only show institutions that work with our app's core feature.
* **[Frontend]:** User selects an institution, capturing the `institution_id`.

### Step 3: Plaid Link Initialization & Token Exchange

* **Trigger:** User has selected their institution.
* **[Backend]:**
  * `PLAID API CALL: POST /link/token/create`
  * **Parameters:** `{ ..., user: { client_user_id: our_user_id }, institution_id: selected_institution_id }`
  * **Rationale:** Passing `institution_id` provides a better UX by skipping Plaid's own search screen.
* **[Frontend]:** Initializes Plaid Link with the `link_token`. Upon user success, receives a `public_token`.
* **[Backend]:**
  * `PLAID API CALL: POST /item/public_token/exchange`
  * **Parameters:** `{ public_token: ... }`
  * **DB ACTION:**
        1. Create a new record in our `items` table.
        2. Securely encrypt and store the received `access_token` and `item_id`.
        3. Initialize a `transactions_cursor` field for this Item to `null`.
  * **ENGINEERING NOTE:** The `access_token` is sensitive and must NEVER be exposed to the frontend.

### Step 4: The One-Time Static Data Pull

* **Trigger:** A new `access_token` has been successfully stored.
* **[Backend]:** Immediately orchestrates the following one-time fetches.
  * **1. Get Account Information:**
    * `PLAID API CALL: POST /accounts/get`
    * **Parameters:** `{ access_token: ... }`
    * **DB ACTION:** For each account returned, create a record in our `accounts` table, linking it to our `item_id`.
    * **ENGINEERING NOTE:** This is the ONLY time this endpoint is called for this Item. This data is now considered permanently cached.
  * **2. Get Initial Transaction History:**
    * `PLAID API CALL: POST /transactions/sync`
    * **Parameters:** `{ access_token: ..., cursor: null }`
    * **DB ACTION:**
            1. Iterate through all pages of the initial sync by looping calls to `/transactions/sync` with the `next_cursor` until `has_more` is `false`.
            2. Insert all received transactions into our `transactions` table.
            3. After the loop completes, **update the `transactions_cursor` in our `items` table** with the final `next_cursor` value.
* **[Frontend]:** Is notified of success and redirects the user to their dashboard, which is now populated with data served from our database.

---

## 3. Phase 2: Core App Experience - Daily Use & Data Sync

**Goal:** Provide a fast, responsive experience for returning users while keeping data fresh in a cost-effective manner.

### Step 5: User Views Dashboard

* **Trigger:** A returning user logs in or loads the dashboard.
* **[Frontend]:** Immediately renders the page layout. It requests account and transaction data from our own backend (e.g., `/api/dashboard-data`).
* **[Backend]:**
    1. Fetches accounts and recent transactions directly from our database. This is fast and free.
    2. Sends this cached data to the frontend immediately so the UI can render.
    3. In parallel, retrieves the user's `access_token` from the database.
    4. Makes a single, fresh call to Plaid for balance data.
        * `PLAID API CALL: POST /accounts/balance/get`
        * **Parameters:** `{ access_token: ... }`
    5. Streams the updated balance data to the frontend to populate the UI.
* **ENGINEERING NOTE:** The user experiences an instant page load with slightly stale transaction data, which is then updated with live balance data a moment later. We do NOT call `/transactions/sync` on page load.

### Step 6: The Automated Sync Loop (Webhook-Driven)

* **Trigger:** Plaid sends a `SYNC_UPDATES_AVAILABLE` webhook to our server endpoint.
* **[Backend]:**
    1. Receives the webhook and validates it.
    2. Extracts the `item_id` from the payload.
    3. Looks up the `item` in our database to retrieve the associated `access_token` and the **last saved `transactions_cursor`**.
    4. `PLAID API CALL: POST /transactions/sync`
    5. **Parameters:** `{ access_token: ..., cursor: last_saved_cursor }`
    6. **DB ACTION:**
        * Processes the response by performing CRUD operations on our `transactions` table for the `added`, `modified`, and `removed` arrays.
        * Updates the `transactions_cursor` for the Item in our database with the `next_cursor` from the response.
* **ENGINEERING NOTE:** This is our primary method for transaction updates. It happens in the background, initiated by Plaid, and keeps our database fresh for the user's next session.

### Step 7: The Manual Refresh (User-Initiated)

* **Trigger:** User clicks a "Refresh My Accounts" button in the UI.
* **[Frontend]:**
    1. Makes a `POST` request to our backend endpoint `/api/plaid/refresh-item`.
    2. The button must be disabled for a period (e.g., 5 minutes) after a successful click to prevent abuse. This is a client-side responsibility.
* **[Backend]:**
    1. Receives the request and retrieves the user's `access_token`.
    2. `PLAID API CALL: POST /transactions/refresh`
    3. **Parameters:** `{ access_token: ... }`
* **ENGINEERING NOTE:** This endpoint returns no data. Its sole purpose is to request that Plaid begin a refresh. The actual data update will be handled by the webhook flow in Step 6 when Plaid finishes the job. This decouples the user action from the data sync and funnels everything through our efficient webhook handler.

---

## 4. Phase 3: System Maintenance

**Goal:** Proactively manage Item health to avoid billing for dead connections.

### Step 8: Pruning Stale Items

* **Trigger:** A scheduled background job (e.g., a weekly cron job).
* **[Backend]:**
    1. Scans our `items` table for any user who has not logged in for over 90 days.
    2. For each stale Item, attempt a lightweight, low-cost API call.
        * `PLAID API CALL: POST /accounts/balance/get`
    3. **Logic:**
        * If the call succeeds, the Item is still valid. Do nothing.
        * If the call fails with an `ITEM_LOGIN_REQUIRED` error, the `access_token` is permanently invalid.
    4. **DB ACTION:** If the error is `ITEM_LOGIN_REQUIRED`, update a `status` field on our `items` table to `disconnected`.
* **ENGINEERING NOTE:** This prevents us from paying for Items that are no longer useful. When a disconnected user logs back in, we will see this status and prompt them to re-connect their account using Plaid Link's "update mode".
