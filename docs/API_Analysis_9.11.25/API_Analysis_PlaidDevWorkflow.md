# Engineering Audit: Aligning Plaid Workflow

**Objective:** To perform a targeted code audit to identify the deltas between our current Plaid integration and the cost-effective Plaid_Workflow.md document. The goal is to produce a set of actionable engineering tasks for alignment.

Here is a breakdown of the key areas to investigate. For each section, document your findings and be prepared to discuss.

## **Area 1: The Onboarding & Item Creation Flow**

The new workflow fetches all static data in a single, atomic operation post-link. We need to see how our current process compares.

**What to Look For:**

1. **Plaid Link Initialization:**
    * How do we currently launch Plaid Link? Are we calling `/link/token/create` *with* or *without* an `institution_id`?
    * If we are not using an `institution_id`, it means we are not using our own custom search UI. Document this.

2. **The `onSuccess` Callback Logic:**
    * Trace the code path from the moment the Plaid Link `onSuccess` callback fires.
    * What API calls are made immediately after we exchange the `public_token` for an `access_token`?
    * **CRITICAL QUESTION:** Do we call `/accounts/get` and `/transactions/sync` sequentially in the same operation? Or do we only fetch one, or redirect the user before fetching?

3. **Cursor Management:**
    * After the initial `/transactions/sync` call, are we capturing the `next_cursor`?
    * Where is it being stored? Check our `items` table schema in the database. Is there a `transactions_cursor` column? If not, that's a major gap.

4. **Account Data Caching:**
    * Find every place in the codebase where we call `POST /accounts/get`.
    * Is it called *only once* during the initial link, or is it called on dashboard loads or other events? Every call after the first is an inefficiency we need to eliminate.

**Your Deliverable for this Area:**

* A sequence diagram or a line-by-line text flow of our **current** onboarding process, from token exchange to when the user sees their dashboard.
* A list of all endpoints that call `/accounts/get`.

---

### **Area 2: The Data Syncing & Daily Use Flow**

This is the most important area for cost savings. The new workflow is **webhook-driven**, not polling-based. We need to find every instance of polling.

**What to Look For:**

1. **Transaction Update Mechanism:**
    * **CRITICAL QUESTION:** How do we currently check for new transactions for an existing user? Is there a cron job that loops through users? Does a user action trigger a full refresh?
    * Search the entire codebase for calls to `POST /transactions/refresh` and `POST /transactions/sync`. Who calls them, and on what trigger (timer, user action, etc.)?

2. **Webhook Implementation:**
    * Do we have a backend endpoint that accepts incoming webhooks from Plaid?
    * If so, does it specifically handle the `SYNC_UPDATES_AVAILABLE` event?
    * Trace its logic. Does it correctly retrieve the `item_id`, look up the last saved `cursor`, call `/transactions/sync`, and then save the new `next_cursor`? If any of these steps are missing, our webhook handler is incomplete.

3. **The User "Refresh" Button:**
    * When a user clicks "Refresh" in the UI, what is the exact chain of events?
    * Does the backend block and wait for Plaid to finish, or does it return immediately? The target is a "fire-and-forget" call to `/transactions/refresh`, with the actual update being handled later by the webhook.

4. **Balance Fetching:**
    * Find every place we call `POST /accounts/balance/get`.
    * Is it called on a timer while the user is on the page (polling)? Or is it only called once when a view is loaded?

**Your Deliverable for this Area:**

* A list of all backend endpoints, cron jobs, or scheduled tasks that call `/transactions/refresh` or `/transactions/sync`.
* An assessment of our webhook handler's current logic against the required logic (fetch cursor -> sync -> save new cursor).

---

### **Area 3: Database & State Management**

Our database schema must support the new, efficient state management.

**What to Look For:**

1. **`items` Table Schema:**
    * Does the table have a `transactions_cursor` (TEXT, nullable) column?
    * Does it have a `status` (e.g., VARCHAR, with values like 'active', 'disconnected') column to track Item health?
    * Does it have a `last_webhook_received_at` timestamp? (Useful for debugging).

2. **Data Serving:**
    * Pick a key UI component, like the main transaction list. Where does it get its data from?
    * Is it hitting an endpoint that serves directly from our database, or is that endpoint making a real-time call to Plaid? Any real-time Plaid calls for rendering transaction lists are a major inefficiency.

**Your Deliverable for this Area:**

* A simple `Current Schema vs. Required Schema` comparison for the `items` table.
* A list of required database migrations.
