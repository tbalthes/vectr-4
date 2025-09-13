# API Audit: Security Analysis (Grade:2.7/10)

## Criteria:

```Security vulnerabilities
* Authentication and authorization: Check that API routes are not publicly accessible when they should be protected. The audit should ensure that authentication tokens (like JWTs) are correctly validated server-side for each request, and that authorization rules are enforced to prevent users from accessing data or performing actions they don't have permission for (Broken Object-Level Authorization).
* Input validation and sanitization: All user-provided data from request bodies, query parameters, and dynamic route segments should be validated and sanitized to prevent injection attacks (like SQL injection or Cross-Site Scripting). Tools like Zod are often used for this.
* Secure data handling:
Environment variables: Ensure that sensitive data like API keys and database credentials are not exposed to the client and are securely stored in environment variables (e.g., in .env.local files).
HTTP-only cookies: Verify that authentication tokens are stored in secure, HttpOnly cookies to mitigate Cross-Site Scripting (XSS) risks.
* Rate limiting: Detect if sensitive endpoints, such as login or password reset routes, lack rate limiting, which could leave them vulnerable to brute-force attacks.
* Secure headers: Audit for the use of secure headers, such as a Content Security Policy (CSP), to protect against various client-side attacks.
```

## Scope

- Project: vectr-4 (Next.js + Python/FastAPI, Supabase/Postgres)
- Focus (per criteria doc):
  1. Authentication & Authorization
  2. Input validation & sanitization
  3. Secure data handling (env secrets, cookies)
  4. Rate limiting
  5. Secure headers/CSP
- Primary Next.js API routes reviewed
  - /api/aggregator/webhook
  - /api/aggregator/plaid/create_link_token
  - /api/aggregator/plaid/exchange_public_token
  - /api/aggregator/plaid/transactions/sync
  - /api/aggregator/plaid/transactions/clean
  - /plaid/webhook (legacy/compat)
- Python (FastAPI): python/app/routers/plaid_api.py (not primary path today, still present)

High-level summary

- Data ingestion and processing now largely lives in Next.js API routes and talks to Supabase.
- Authentication relies on Supabase session cookies; some internal calls bypass cookies via internal_user_id.
- Webhook authenticity verification is currently disabled, and some internal endpoints lack strong authorization guards.
- Input validation is sparse; Zod dependency exists but is not consistently used.
- No rate limiting configured on sensitive routes (webhooks, token exchange).
- Security headers/CSP not explicitly configured.

Risk ratings (now)

- Critical: Webhook verification missing; internal processor callable without shared secret; service-role key safety review; cookie usage bug in some routes.
- High: Missing/weak input validation on several API handlers; no rate limiting on webhook/PII-sensitive endpoints.
- Medium: CSP/headers not defined; error logs may include sensitive payloads.

---

1. Authentication & Authorization

Findings

- Webhook verification disabled

  - Log seen: “[webhook] No PLAID_WEBHOOK_SECRET set, skipping verification”
  - Current implementation does not validate Plaid’s signature (newer Plaid verification is signature/JWS-based, not a shared secret).
  - Impact: Anyone can post to /api/aggregator/webhook and trigger syncs.

- Internal “clean processor” bypass

  - /api/aggregator/plaid/transactions/clean accepts internal_user_id for server-to-server flow.
  - No server-shared secret or signed token to prove the caller is trusted.
  - Impact: Endpoint could be invoked by untrusted callers, forging user_id and writing transactions.

- Cookie access bug (Next.js dynamic APIs)

  - Errors observed: “Route ... used cookies().get(...). cookies() should be awaited…”
  - Impact: Session resolution may fail intermittently; can lead to unauthenticated behavior fallback paths.

- Service role key safety
  - .env.local contains PRIVATE_SUPABASE_SERVICE_ROLE (good: no NEXT_PUBLIC prefix).
  - Verify it is never imported from client-bundled code. Any direct usage must be strictly server-only.

Recommendations

- Enforce webhook signature verification (Plaid verification keys/JWS).
- Protect internal-only endpoints (e.g., X-Internal-Secret header, or signed JWT).
- Fix cookie reading to use the async cookies API in all route handlers/helpers.
- Add idempotency guard for item+cursor (avoid repeated sync from multiple events).

Actionable patches (skeletons)

- Fix cookie access helper

```typescript
// filepath: c:\Users\Travis\vectr-6\vectr-4\src\lib\helpers.ts
// ...existing code...
import { cookies } from "next/headers";

export async function getCookie(name: string) {
  const jar = await cookies(); // IMPORTANT: await the async getter
  return jar.get(name)?.value ?? null;
}
// ...existing code...
```

- Require internal secret for clean processor

```typescript
// filepath: c:\Users\Travis\vectr-6\vectr-4\src\app\api\aggregator\plaid\transactions\clean\route.ts
// ...existing code...
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

export async function POST(req: NextRequest) {
  // Require a shared secret for server-to-server invocations
  const supplied = req.headers.get("x-internal-secret");
  if (!INTERNAL_SECRET || supplied !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // proceed with existing logic...
}
// ...existing code...
```

- Webhook signature verification (outline)

```typescript
// filepath: c:\Users\Travis\vectr-6\vectr-4\src\app\api\aggregator\webhook\route.ts
// ...existing code...
// Pseudocode outline (see Plaid docs for exact verification flow):
// 1. Read `Plaid-Verification` (JWS), `Plaid-Verification-Key-Id`, and version headers
// 2. Fetch Plaid public key for key_id (cache in memory for TTL)
// 3. Verify JWS against raw body (detached payload rules per docs)
// 4. If verification fails: return 401

// NOTE: Implement with `jose` or Plaid’s recommended method; keep key fetch server-side only.
// ...existing code...
```

---

2. Input validation & sanitization

Findings

- Many handlers accept JSON bodies without schema validation.
  - /api/aggregator/webhook (payload from third party)
  - /api/aggregator/plaid/transactions/clean (large arrays of transactions)
  - /api/aggregator/plaid/exchange_public_token (must validate public_token)
- Zod is available but not applied consistently.
- Potential risk: malformed input, noisy DB writes, or injection vectors through unescaped text fields (category, merchant regex, descriptions).

Recommendations

- Add Zod schemas per route; reject invalid payloads early with 400.
- Sanitize strings written to DB; normalize/limit regex patterns stored or executed.
- Normalize dates/money values (number/decimal) strictly.

Actionable patch (example for webhook)

```typescript
// filepath: c:\Users\Travis\vectr-6\vectr-4\src\app\api\aggregator\webhook\validators.ts
import { z } from "zod";

export const plaidWebhookSchema = z.object({
  webhook_type: z.string(),
  webhook_code: z.string(),
  item_id: z.string(),
  environment: z.string().optional(),
  // add specific fields for TRANSACTIONS codes:
  // new_transactions, removed, etc. as needed from Plaid docs
});
```

```typescript
// filepath: c:\Users\Travis\vectr-6\vectr-4\src\app\api\aggregator\webhook\route.ts
// ...existing code...
import { plaidWebhookSchema } from "./validators";
// ...
const raw = await req.text();
const parsed = plaidWebhookSchema.safeParse(JSON.parse(raw));
if (!parsed.success) {
  return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
}
// const body = parsed.data;
// ...existing code...
```

---

3. Secure data handling (env, cookies, logging)

Findings

- Supabase anon key (NEXT_PUBLIC...) is public by design; OK.
- Service role key present as PRIVATE_SUPABASE_SERVICE_ROLE; ensure never imported in client modules.
- Logs sometimes print entire webhook bodies and transaction payloads (risk of sensitive data in logs).
- Supabase cookie usage: ensure HttpOnly, Secure, SameSite per Supabase defaults; don’t copy cookie values to client responses.

Recommendations

- Ensure any file that imports PRIVATE_SUPABASE_SERVICE_ROLE is server-only (API route, not client component).
- Scrub logs: avoid printing full payloads or access tokens; prefer structural logs (counts/ids hashed).
- Add server-only runtime guard:
  - Place server-only code in API routes or use `import "server-only"` where appropriate.

Quick guard example

```typescript
// filepath: c:\Users\Travis\vectr-6\vectr-4\src\lib\server-only.ts
import "server-only";
// Import this module from any file that must never be bundled client-side
```

---

4. Rate limiting

Findings

- No rate limits on /api/aggregator/webhook, /plaid/webhook, /plaid/\* token routes.
- Risk: replay floods, billing spikes, resource exhaustion.

Recommendations

- Add lightweight rate limiting at minimum on:
  - /api/aggregator/webhook (per source IP)
  - /api/aggregator/plaid/exchange_public_token (per user)
- Consider Upstash Rate Limit (easy with Next.js).

Actionable patch (Upstash example)

```typescript
// filepath: c:\Users\Travis\vectr-6\vectr-4\src\middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const limiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(60, "1 m"),
});

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/aggregator/webhook")) {
    const ip = req.headers.get("x-forwarded-for") ?? req.ip ?? "unknown";
    const { success } = await limiter.limit(`webhook:${ip}`);
    if (!success)
      return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/aggregator/webhook"] };
```

---

5. Secure headers / CSP

Findings

- No explicit CSP/security headers set at the framework level.
- Risk: XSS, clickjacking, broad 3rd-party permissions.

Recommendations

- Add a conservative CSP, Referrer-Policy, Frame-Options/Frame-Ancestors, Permissions-Policy, Strict-Transport-Security.

Actionable patch (example headers)

```typescript
// filepath: c:\Users\Travis\vectr-6\vectr-4\next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=()",
          },
          // Adjust CSP to your asset/CDN domains as needed
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:;",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
```

---

Priority checklist (short)

- [ ] Implement Plaid webhook signature verification (block unverified).
- [ ] Require INTERNAL_API_SECRET for internal clean processor calls.
- [ ] Fix all cookie reads to use async cookies() API.
- [ ] Add Zod validation to webhook, token exchange, and clean processor routes.
- [ ] Add rate limiting to /api/aggregator/webhook and token exchange.
- [ ] Add CSP and security headers in next.config.js.
- [ ] Remove sensitive payloads from logs.
- [ ] Ensure service-role key is never imported by client code.
- [ ] Add idempotency guard for per-item sync (cursor/version).

Notes for later parts

- Part 2: Endpoint-by-endpoint audit and suggested refactors to remove “proxy-to-Supabase” routes.
- Part 3: Performance & reliability (background jobs, idempotency, dedupe, webhook retries).
- Part 4: Developer workflow and observability (structured logs, metrics, tracing).

---

## Security Scoring Rubric and Grade (Appended)

### Rubric (Total 10 points)

| Category                                        | Max | Description                                                                                                                    |
| ----------------------------------------------- | --: | ------------------------------------------------------------------------------------------------------------------------------ |
| 1. AuthN/AuthZ & Webhook Verification           | 2.5 | Strong authentication on all routes; Plaid webhook signature/JWS verification enforced; least-privilege access; RLS leveraged. |
| 2. Input Validation & Sanitization              | 2.0 | Schemas (e.g., Zod) enforce type/format on all inputs; reject invalid payloads; sanitize strings.                              |
| 3. Secure Data Handling (Secrets, Cookies, PII) | 2.0 | Secrets server-only; no leakage to client; HttpOnly/SameSite cookies; avoid logging sensitive data.                            |
| 4. Rate Limiting & Abuse Protection             | 1.5 | Appropriate rate limits on sensitive endpoints (webhooks, token exchange); bot/DoS protections.                                |
| 5. Secure Headers/CSP                           | 1.0 | CSP, HSTS, Referrer-Policy, X-Content-Type-Options, Permissions-Policy applied.                                                |
| 6. Idempotency & Replay Protection              | 0.5 | Webhook/event idempotency keys; dedupe guards for sync.                                                                        |
| 7. Logging & Error Hygiene                      | 0.5 | Generic client errors; structured server logs; no secrets in logs.                                                             |

### Scoring (based on current report findings)

- 1. AuthN/AuthZ & Webhook Verification (2.5 max): 0.5
  - Webhook verification is disabled; internal-only endpoints lack shared secret/JWT. Supabase RLS in place, but gaps exist for internal flows.
- 2. Input Validation & Sanitization (2.0 max): 0.5
  - Zod present but not consistently used; several routes accept unvalidated payloads.
- 3. Secure Data Handling (2.0 max): 1.0
  - Service role key appears server-only, but logs may include sensitive payloads; cookie usage bugs noted; partial compliance.
- 4. Rate Limiting & Abuse Protection (1.5 max): 0.2
  - No rate limiting on webhooks or token exchange; recommendation pending.
- 5. Secure Headers/CSP (1.0 max): 0.1
  - No explicit CSP/security headers configured.
- 6. Idempotency & Replay Protection (0.5 max): 0.2
  - Some idempotency discussed (cursor), but no explicit idempotency keys for webhooks; risk of duplicate processing.
- 7. Logging & Error Hygiene (0.5 max): 0.2
  - Verbose logs with payloads; inconsistent error responses; needs normalization.

### Total Score

- Awarded: 0.5 + 0.5 + 1.0 + 0.2 + 0.1 + 0.2 + 0.2 = **2.7 / 10**
- Grade: **2.7 / 10** (Significant remediation recommended)

### Priority Remediations (Top 6)

1. Enforce Plaid webhook signature/JWS verification; reject unverified.
2. Protect internal-only routes with `X-Internal-Secret` or signed JWT and verify on each call.
3. Add Zod schemas to all API inputs (webhook, token exchange, clean, sync); fail fast with 400.
4. Implement rate limits on `/api/aggregator/webhook` and token exchange routes.
5. Add security headers (CSP, HSTS, Referrer-Policy, X-Content-Type-Options, Permissions-Policy).
6. Introduce idempotency keys (per item/event) and dedupe guards to prevent replay/duplicates; reduce sensitive data in logs and standardize error responses.
