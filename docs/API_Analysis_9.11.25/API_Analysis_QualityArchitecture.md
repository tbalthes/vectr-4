# API Audit: Code Quality & Architecture (Grade:5.4/10)

## Criteria

- Code organization: consistent, maintainable folder structure by feature/resource.
- Single Responsibility Principle (SRP): each route has a focused purpose.
- Code reusability: shared utilities/middleware for auth, validation, logging.
- Separation of concerns: server vs client boundaries; no secret leakage.
- Use of Middleware: central cross-cutting concerns (auth, rate limits, logging).

## Scope

- Project: vectr-4 (Next.js App Router + API routes, Supabase/Postgres, Plaid)
- Criteria source: docs/API_Analysis_9.11.25/API_Analysis_QualityArchitecture.md
- Routes reviewed (primary):
  - /api/aggregator/webhook
  - /api/aggregator/plaid/create_link_token
  - /api/aggregator/plaid/exchange_public_token
  - /api/aggregator/plaid/transactions/sync
  - /api/aggregator/plaid/transactions/clean
  - /plaid/webhook (legacy logger/forwarder)

---

## 1. Code Organization

**Findings**

- API routes are grouped under feature domains (e.g., `aggregator/plaid/...`), which is good for discoverability.
- Some business logic sits directly inside route handlers (e.g., transaction cleaning), making files large and harder to unit-test.
- Shared concerns (Supabase client creation, auth/session extraction, validation, logging) are duplicated across routes.

**Recommendations**

- Extract business logic into dedicated modules under `src/lib` (e.g., `src/lib/plaid/`, `src/lib/transactions/`). Keep route handlers thin.
- Create a `src/lib/api/` folder for common HTTP helpers (auth, validation, error responses, idempotency, rate limiting wrappers).
- Keep feature-oriented structure but ensure consistent naming (route.ts + colocated helpers where small; otherwise import from lib).

**Example structure**

```
src/
  app/
    api/
      aggregator/
        webhook/route.ts
        plaid/
          create_link_token/route.ts
          exchange_public_token/route.ts
          transactions/
            sync/route.ts
            clean/route.ts
  lib/
    api/
      auth.ts       // server-side auth extraction (Supabase cookies, headers)
      validator.ts  // zod helpers
      errors.ts     // standardized error responses
      rateLimit.ts  // shared rate limiting
      sentry.ts     // error monitoring init
    plaid/
      client.ts     // Plaid client factory
      sync.ts       // Plaid /transactions/sync orchestration
    transactions/
      clean.ts      // clean/normalize pipeline
      bulk.ts       // bulk upsert + dedupe
      mapping.ts    // merchant/category/account mapping helpers
```

---

## 2. Single Responsibility Principle (SRP)

**Findings**

- Several route handlers perform orchestration + business logic + persistence + response formatting in a single file.
- Webhook route both verifies, persists event, and triggers sync; separation would improve testability.

**Recommendations**

- Split responsibilities:
  - Route = parse/validate → call service → translate service result to HTTP response.
  - Service layer (`lib/...`) = business rules and orchestration.
  - Data layer = Supabase/SQL helpers (thin wrappers), with clear contracts.

**Example (route → service)**

```typescript
// route.ts
import { withErrorHandling } from "@/lib/api/errors";
import { plaidWebhookHandler } from "@/lib/plaid/webhookService";

export const POST = (req: Request) =>
  withErrorHandling(async () => {
    const raw = await req.text();
    const res = await plaidWebhookHandler(raw, req.headers);
    return new Response(JSON.stringify(res.body), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  });
```

---

## 3. Code Reusability

**Findings**

- Common patterns (Supabase client creation, auth extraction, zod validation, standardized errors) are repeated.

**Recommendations**

- Introduce reusable helpers:
  - `getSupabaseAdmin()` and `getSupabaseForUser()` server-only factories.
  - `validate(schema, data)` wrapper using Zod with consistent error formatting.
  - `error(code, message, status)` responder to unify error JSON shape.
  - `requireInternalSecret(req)` for trusted internal calls.

**Examples**

```typescript
// lib/api/auth.ts
import { cookies } from "next/headers";
export async function getUserSession() {
  const jar = await cookies();
  const token = jar.get("sb-access-token")?.value ?? null;
  return token; // extend to fetch user if needed
}
```

```typescript
// lib/api/validator.ts
import { z } from "zod";
export function validate(schema: z.ZodSchema, input: unknown) {
  const result = schema.safeParse(input);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: result.error.message,
        issues: result.error.issues,
      },
    };
  }
  return { ok: true, data: result.data } as const;
}
```

```typescript
// lib/api/errors.ts
export function error(code: string, message: string, status = 400) {
  return new Response(JSON.stringify({ code, message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
```

---

## 4. Separation of Concerns (Server vs Client)

**Findings**

- Secrets (service role keys, Plaid secrets) are used only in server routes; good. Risk remains if helpers are imported from client components.
- Some server helpers lack `server-only` guard, which helps prevent accidental client import.

**Recommendations**

- Add `import 'server-only'` in files that must never be bundled client-side (supabase admin, plaid client, env loaders).
- Audit imports from client components—ensure they never import server-only modules.
- Keep large processing strictly on the server (route handlers or edge functions) and expose minimal data to clients.

**Example guard**

```typescript
// lib/server-only.ts
import "server-only";
```

---

## 5. Middleware Usage

**Findings**

- `middleware.ts` can centralize cross-cutting concerns (rate limiting for webhooks, request IDs, light auth gates), but not fully leveraged.

**Recommendations**

- Add middleware for:
  - Assigning a request ID header (e.g., `x-request-id`) to correlate logs.
  - Basic rate limiting for hot endpoints (e.g., webhooks) using Upstash or lightweight counter.
  - Early rejection for missing internal secret on internal-only paths.

**Example (request ID)**

```typescript
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const reqId = crypto.randomUUID();
  res.headers.set("x-request-id", reqId);
  return res;
}
export const config = { matcher: ["/api/:path*"] };
```

---

## Refactor Targets (Remove/Proxy-to-Supabase)

**Findings**

- Any route that simply forwards CRUD to Supabase with no added auth/aggregation should be removed and replaced with direct Supabase access (RLS-protected) from server components or client (as appropriate).

**Action Plan**

1. Inventory API routes that only proxy to Supabase.
2. For each, migrate consumers to use `@supabase/supabase-js` directly with RLS.
3. Keep routes that:
   - Integrate with Plaid/webhooks/3rd parties.
   - Use server-only secrets.
   - Aggregate or enrich data across multiple tables/services.
   - Enforce additional authorization beyond RLS.

---

## Checklist (Quality & Architecture)

- [ ] Route handlers are thin; business logic in `lib/` services.
- [ ] Shared helpers for auth, validation, errors, rate limiting.
- [ ] Server-only guards added to sensitive modules.
- [ ] Middleware provides request IDs and (optional) rate limiting.
- [ ] Remove/refactor proxy-to-Supabase routes.
- [ ] Consistent naming and folder structure by feature.

---

## Notes for Implementation

- Start with webhook + sync + clean paths: extract orchestration into `lib/plaid` and `lib/transactions`.
- Introduce `lib/api` utilities and migrate routes incrementally.
- Add minimal middleware (request ID) first; then rate limiting where needed.
- Create small unit tests for `lib/transactions/clean.ts` once extracted to keep refactors safe.

---

## Quality/Architecture Scoring Rubric and Grade (Appended)

### Rubric (Total 10 points)

| Category                                     | Max | Description                                                                                            |
| -------------------------------------------- | --: | ------------------------------------------------------------------------------------------------------ |
| 1. Code Organization & Structure             | 2.0 | Feature-oriented, consistent foldering; thin routes; logic extracted to `lib/` services; clear naming. |
| 2. SRP & Modularity                          | 2.0 | Each route focused on a single responsibility; orchestration separate from persistence and transport.  |
| 3. Reuse & Shared Utilities                  | 2.0 | Common helpers for auth, validation, errors, rate limiting, logging; minimal duplication.              |
| 4. Separation of Concerns (Server vs Client) | 1.5 | Strict server-only boundaries; `server-only` guards; secrets never leak to client.                     |
| 5. Middleware & Cross-Cutting Concerns       | 1.0 | Middleware used for request IDs, rate limiting, lightweight auth gates where appropriate.              |
| 6. Consistency & Documentation               | 1.0 | Consistent naming, response shapes, and conventions; inline docs where needed.                         |
| 7. Testability                               | 0.5 | Core logic in testable modules; unit tests feasible without HTTP or DB.                                |

### Scoring (based on current report findings)

- 1. Code Organization & Structure (2.0 max): 1.2
  - Good feature grouping; however, substantial business logic remains in route handlers. Recommendation to extract into `lib/` pending.
- 2. SRP & Modularity (2.0 max): 1.0
  - Routes mix orchestration, business rules, and persistence (e.g., webhook → verify + persist + trigger). Needs clearer splits.
- 3. Reuse & Shared Utilities (2.0 max): 0.9
  - Repeated patterns (Supabase client creation, validation, error shaping); shared helpers suggested but not yet present.
- 4. Separation of Concerns (1.5 max): 1.0
  - Secrets used server-side; recommend `server-only` guards and audit of imports to prevent accidental client bundling.
- 5. Middleware & Cross-Cutting (1.0 max): 0.4
  - Middleware opportunities identified (request ID, rate limiting), limited current usage.
- 6. Consistency & Documentation (1.0 max): 0.7
  - Overall consistent naming/structure; response shapes not fully standardized; limited inline docs.
- 7. Testability (0.5 max): 0.2
  - Heavy logic in routes reduces unit-testability; extraction will improve.

### Total Score

- Awarded: 1.2 + 1.0 + 0.9 + 1.0 + 0.4 + 0.7 + 0.2 = **5.4 / 10**
- Grade: **5.4 / 10** (Solid foundation; benefits from modularization and shared utilities)

### Priority Refactors (Top 6)

1. Extract business logic from `webhook`, `transactions/sync`, and `transactions/clean` into `lib/plaid` and `lib/transactions` services.
2. Introduce `lib/api` helpers for auth extraction, zod validation, standardized errors, rate limiting wrappers, and Sentry logging.
3. Add `import 'server-only'` to sensitive modules (supabase admin, plaid client, env loaders) and audit imports from client components.
4. Implement middleware for `x-request-id` and lightweight rate limiting on hot endpoints.
5. Standardize response shapes and error contracts across all routes; document route contracts briefly in code.
6. Add minimal unit tests for extracted `clean` and `mapping` modules; keep routes thin and easily testable.
