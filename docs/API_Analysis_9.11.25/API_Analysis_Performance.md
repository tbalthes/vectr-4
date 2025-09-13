# API Audit: Performance & Efficiency (Grade:4/10)

## Criteria

```## Performance and efficiency
Caching:
* Server-side caching: Look for redundant API calls that can be optimized with server-side caching using Next.js's built-in features, stale-while-revalidate headers, or custom logic.
* Data fetching patterns: For the Pages Router, evaluate if getServerSideProps is used appropriately for server-side-rendered pages. For the App Router, ensure that Server Components and Route Handlers leverage the latest data-fetching and caching patterns.
* Route handler payload: Check that API routes avoid heavy, synchronous computations and minimize dependencies to reduce serverless function overhead and latency.
* Database query optimization: If API routes query a database, the audit should look for inefficient queries, missing indexes, or N+1 query problems.
* Bundle size: Ensure API routes are not unintentionally including large client-side dependencies, which increases serverless function size and boot time.
Data integrity
* Data validation: Ensure that all incoming data is correctly validated against a defined schema. For example, check that the types, formats, and constraints of all fields in the request body, query, and params match what the server expects.
* Data sanitization: Confirm that the API routes' output data is sanitized before being returned, stripping any sensitive or unnecessary information, especially when sending data to client components.
```

## Scope

- Project: vectr-4 (Next.js API routes, Supabase/Postgres, Plaid)
- Criteria source: docs/API_Analysis_9.11.25/API_Analysis_Performance.md
- Routes reviewed (primary):
  - /api/aggregator/webhook
  - /api/aggregator/plaid/create_link_token
  - /api/aggregator/plaid/exchange_public_token
  - /api/aggregator/plaid/transactions/sync
  - /api/aggregator/plaid/transactions/clean
  - /plaid/webhook (legacy logger/forwarder)

## High-level Summary

- Transaction ingestion works but does repeated heavy work per request (merchant/category lookups, per-row writes).
- No shared caches for hot dictionaries (merchants, categories, accounts map plaid_account_id → internal id).
- Clean processor writes transactions one-by-one; should use bulk upserts and dedupe keys to reduce round trips.
- API routes log large payloads; this increases latency and I/O.
- Read endpoints (when present) don’t advertise caching hints; everything is dynamic (OK for webhooks, suboptimal for reads).
- Potential N+1 risks in merchant/category resolution if done inside loops with DB roundtrips.

## Priority Recommendations (TL;DR)

1. Add in-memory caches for “hot” reference data during a single request (merchants, categories, plaid→internal account map).

2. Switch transaction persistence to chunked bulk upsert with a unique constraint on aggregator_transaction_id.

3. Normalize merchant matching (precompiled regex, lowercase normalization) and avoid per-row DB hits.

4. Ensure sync uses Plaid /transactions/sync cursor correctly and is idempotent (don’t re-clean already-stored txns).

5. Reduce logging of full payloads; log counts and identifiers only.

6. Add DB indexes aligned to query patterns to prevent sequential scans.

---

## 1. Caching

Findings

- Merchant/category dictionaries are recomputed or re-fetched repeatedly inside transaction-cleaning loops.
- Plaid account_id → internal account UUID is resolved per transaction (expensive).

Actions

- Build a per-request cache (Map) for:
  - plaid_account_id → internal_account_uuid
  - category_code → category_id
  - merchant_name_norm → merchant_id
- Optionally, a short-lived global LRU (per worker) for static dictionaries (categories).

Example: request-scoped caches used by the clean processor

```typescript
// filepath: c:\Users\Travis\vectr-6\vectr-4\src\lib\processing/caches.ts
export type AccountMap = Map<string, string>; // plaid_account_id -> internal uuid
export type CategoryMap = Map<string, string>; // code/key -> category_id
export type MerchantMap = Map<string, string>; // normalized name -> merchant_id

export interface ProcessingCaches {
  accounts: AccountMap;
  categories: CategoryMap;
  merchants: MerchantMap;
}

export function createProcessingCaches(): ProcessingCaches {
  return {
    accounts: new Map(),
    categories: new Map(),
    merchants: new Map(),
  };
}
```

Use these caches within a single clean run; pre-warm with one query per dictionary instead of N small queries.

---

## 2. Data fetching patterns (App Router)

Findings

- Webhook and sync routes must remain dynamic (no caching).
- Read APIs (if any) return dynamic data without revalidate hints; okay, but can set `cache: 'no-store'` explicitly for clarity.

Actions

- For any GET read route that can be cached (e.g., reference data like categories), add:
  - `export const revalidate = 3600` (server hint) OR
  - respond with Cache-Control headers (stale-while-revalidate).

Example (categories reference endpoint)

```typescript
// filepath: c:\Users\Travis\vectr-6\vectr-4\src\app\api\categories/ref/route.ts
export const revalidate = 3600; // 1 hour

export async function GET() {
  // fetch categories once; rely on DB cache/indexes
  // return JSON with proper headers automatically set by Next (or set custom)
  // ...
}
```

---

## 3. Route handler payload & compute

Findings

- Clean route processes large arrays synchronously with per-row work.
- Logging full bodies and full transaction records increases CPU and console I/O.
- Potential unbounded concurrency when mapping/saving.

Actions

- Batch insert with chunk size (e.g., 250–500).
- Use a stable conflict target (unique index) for idempotence.
- Limit concurrency with a small pool (e.g., 4–8) if any async per-row operations remain.
- Avoid logging transaction bodies; log counts and the first/last IDs only.

Example: chunked bulk upsert with Supabase

```typescript
// filepath: c:\Users\Travis\vectr-6\vectr-4\src\app\api\aggregator\plaid\transactions\clean\_bulk.ts
import { createClient } from "@supabase/supabase-js";

export async function bulkUpsertTransactions(
  supabase: ReturnType<typeof createClient>,
  rows: any[],
  chunkSize = 250
) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("transactions").upsert(chunk, {
      onConflict: "aggregator_transaction_id",
      ignoreDuplicates: false,
    });
    if (error) throw error;
  }
}
```

---

## 4. Database query optimization

Findings

- Recent errors showed attempts to store Plaid account IDs where UUIDs are expected; a mapping step now exists, but ensure it’s indexed.
- Merchant matching appears to rely on regex patterns; repeated DB lookups can be expensive.
- Potential scans on transactions by user_id/date/category for list pages and filters.

Index & constraint recommendations (Postgres)

```sql
-- filepath: c:\Users\Travis\vectr-6\vectr-4\docs\db\performance_indexes.sql
-- Ensure idempotent upserts on inbound transactions
CREATE UNIQUE INDEX IF NOT EXISTS ux_transactions_agg_id
  ON public.transactions (aggregator_transaction_id);

-- Common listing/filtering needs
CREATE INDEX IF NOT EXISTS ix_transactions_user_date
  ON public.transactions (user_id, date DESC);

CREATE INDEX IF NOT EXISTS ix_transactions_user_category_date
  ON public.transactions (user_id, category_id, date DESC);

CREATE INDEX IF NOT EXISTS ix_transactions_user_needs_review_date
  ON public.transactions (user_id, needs_review, date DESC);

-- Account mapping (fast lookups by Plaid account_id)
CREATE UNIQUE INDEX IF NOT EXISTS ux_accounts_plaid_id
  ON public.accounts (aggregator_account_id);

-- If merchants are matched by normalized name
CREATE INDEX IF NOT EXISTS ix_merchants_name_norm
  ON public.merchants (name_normalized);

-- If you store JSONB from Plaid in user_metadata
-- and occasionally query into it, add a GIN index
CREATE INDEX IF NOT EXISTS ix_transactions_user_metadata
  ON public.transactions USING GIN (user_metadata);
```

Merchant/category resolution

- Preload merchants and categories into memory for the clean run.
- Normalize input (lowercase, strip punctuation) and match first in-memory; only hit DB for misses.
- Precompile regex patterns once per run if still needed.

---

## 5. Bundle size in route handlers

Findings

- Ensure server handlers import only server libraries; avoid UI libs or large client-only deps in API routes.
- Plaid SDK and Supabase server client are fine; keep helpers small and colocated.

Actions

- Verify no UI/component imports in API routes.
- Consider extracting shared helpers into small server-only files (add `import "server-only"` guards if needed).

---

## 6. Data integrity: validation & sanitization (perf angle)

Findings

- Lack of schemas can lead to wide payloads and noisy/invalid writes.
- Regex patterns may be DB-engine-specific; normalize to a single engine (JS on server) to avoid mis-matches and wasted cycles.

Actions

- Apply Zod schemas at API boundaries to fail fast (small error response, no DB work).
- Sanitize descriptions and merchant names (trim, collapse whitespace, lowercase normalized copy).

Example: thin schema for clean input

```typescript
// filepath: c:\Users\Travis\vectr-6\vectr-4\src\app\api\aggregator\plaid\transactions\clean\schema.ts
import { z } from "zod";
export const CleanPayload = z.object({
  internal_user_id: z.string().uuid(),
  transactions: z.array(
    z.object({
      transaction_id: z.string(),
      account_id: z.string(), // Plaid account_id
      amount: z.number(),
      date: z.string(), // ISO date
      name: z.string().optional(),
      category: z.string().optional(),
      // ... add required Plaid fields you use
    })
  ),
});
```

---

## 7. Observability (to support performance)

Findings

- Logs are verbose and include full payloads; harder to spot bottlenecks, more I/O.
- No timing spans per phase (fetch, map, upsert).

Actions

- Add concise structured logs with timings per stage:
  - fetched from Plaid (count, ms)
  - preloaded dictionaries (ms)
  - clean map (count, ms)
  - bulk upsert (batches, total ms)
- Log only IDs/counts (no PII), sample 1–2 records when needed behind an env flag.

Example: timing helper

```typescript
// filepath: c:\Users\Travis\vectr-6\vectr-4\src\lib\perf.ts
export function time<T>(label: string, fn: () => Promise<T>) {
  const start = Date.now();
  return fn().then((res) => {
    console.log(`[perf] ${label}: ${Date.now() - start}ms`);
    return res;
  });
}
```

Use like:

- await time("preload-merchants", preloadMerchants)
- await time("bulk-upsert (3 batches)", () => bulkUpsertTransactions(...))

---

## 8. Remove/Refactor proxy-to-Supabase routes

Findings

- Some routes may only pass through to Supabase (not listed here explicitly).
- Keeping them increases latency and code surface.

Actions

- For purely CRUD reads/writes guarded by RLS, call Supabase directly from client or Server Components.
- Keep API routes only where:
  - They integrate third parties (Plaid/webhooks),
  - Need server-only secrets,
  - Aggregate/transform data,
  - Enforce additional auth/authorization.

---

## Checklist (Performance-focused)

- [ ] Implement request-scoped caches for accounts/categories/merchants in clean processor.
- [ ] Switch to bulk upsert with onConflict=aggregator_transaction_id (chunk size 250–500).
- [ ] Preload dictionaries once per clean run; remove per-row DB hits.
- [ ] Add Postgres indexes listed above (apply via migration).
- [ ] Reduce payload logging; add structured stage timings.
- [ ] Add `revalidate`/Cache-Control to read-only reference routes; keep webhooks no-store.
- [ ] Verify no UI/client deps imported in API handlers.
- [ ] Validate inputs with Zod to fail fast (smaller CPU/IO cost).
- [ ] Confirm /transactions/sync cursor flow prevents reprocessing already-stored txns.

Notes for next parts

- Part 3: Reliability & Background processing (idempotency keys, queues, retries, dedupe).
- Part 4: Developer workflow & observability (metrics, error budgets, dashboards).

## Performance/Efficiency Scoring Rubric and Grade (Appended)

### Rubric (Total 10 points)

| Category                                   | Max | Description                                                                                              |
| ------------------------------------------ | --: | -------------------------------------------------------------------------------------------------------- |
| 1. Caching Strategy                        | 2.0 | Appropriate use of server-side caching, SWR/revalidate, and per-request caches to avoid redundant calls. |
| 2. Data Fetching Patterns                  | 1.5 | Correct App Router patterns; explicit `no-store` for dynamic; caching hints for static refs.             |
| 3. Handler Compute & Batching              | 2.0 | Avoid heavy synchronous loops; use chunked bulk operations; bounded concurrency.                         |
| 4. Database Optimization                   | 2.0 | Proper indexes, dedupe keys, minimized N+1 patterns, efficient mapping lookups.                          |
| 5. Bundle Size Discipline                  | 0.5 | Server handlers avoid client/UI deps; small, focused imports.                                            |
| 6. Validation & Sanitization (Perf impact) | 1.0 | Schema validation at boundaries to fail fast; normalized inputs to reduce downstream work.               |
| 7. Observability for Performance           | 1.0 | Structured timing logs, stage metrics (fetch, map, upsert), minimal payload logging.                     |

### Scoring (based on current report findings)

1. Caching Strategy (2.0 max): 0.8
   - No shared caches for hot dictionaries; recommendations provided. Some routes inherently dynamic.
2. Data Fetching Patterns (1.5 max): 0.7
   - Dynamic endpoints fine; static/reference routes lack revalidate hints; suggest `revalidate` or SWR.
3. Handler Compute & Batching (2.0 max): 0.6
   - Clean route does per-row writes and heavy per-item work; bulk upsert/batching not yet implemented.
4. Database Optimization (2.0 max): 0.9
   - Index recommendations identified; unique constraints for idempotency advised; current risks of scans and N+1 present.
5. Bundle Size Discipline (0.5 max): 0.3
   - No explicit issues noted; caution to avoid client deps; partial credit pending verification.
6. Validation & Sanitization (1.0 max): 0.4
   - Lack of schemas increases wasted work on invalid inputs; recommendations to add Zod and normalize strings.
7. Observability for Performance (1.0 max): 0.3
   - Verbose payload logs; missing stage timings; provided timing helper suggestion.

### Total Score

- Awarded: 0.8 + 0.7 + 0.6 + 0.9 + 0.3 + 0.4 + 0.3 = **4.0 / 10**
- Grade: **4.0 / 10** (Noticeable inefficiencies; clear wins available via caching, batching, and indexing)

### Priority Performance Remediations (Top 6)

1. Introduce request-scoped caches and pre-warm dictionaries (accounts/categories/merchants) to cut repeated DB hits.
2. Switch to chunked bulk upserts (250–500) with `onConflict = aggregator_transaction_id` and ensure unique index.
3. Normalize merchant matching (precompiled regex, lowercase normalization) and avoid per-row lookups; only hit DB on misses.
4. Add key Postgres indexes (listed above) and confirm query plans avoid sequential scans on large tables.
5. Reduce payload logging; add structured timing logs per stage (fetch, map, upsert) to locate hotspots.
6. Add `revalidate`/Cache-Control hints to reference GET routes; keep webhooks explicit `no-store`.
