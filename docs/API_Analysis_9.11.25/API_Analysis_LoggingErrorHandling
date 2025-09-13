# API Audit: Error Handling & Logging (Grade:4.1/10)

## Criteria

- Robust error handling: All API routes and downstream functions (e.g., database calls) should be wrapped in try...catch blocks to prevent unhandled exceptions from crashing the application.
- Non-sensitive errors: API routes should return generic, non-descriptive error messages to clients for security. Detailed error information (e.g., stack traces) should only be logged server-side.
- Standardized error responses: Consistent error response formats (e.g., JSON objects with `code` and `message` properties) should be used across all API routes for a predictable client experience.
- Observability: Use of robust logging and monitoring tools (like Sentry or LogRocket) to capture and track errors in production.

## Scope

- Project: vectr-4 (Next.js API routes, Supabase/Postgres, Plaid)
- Criteria source: docs/API_Analysis_9.11.25/API_Analysis_LoggingErrorHandling
- Routes reviewed (primary):
  - /api/aggregator/webhook
  - /api/aggregator/plaid/create_link_token
  - /api/aggregator/plaid/exchange_public_token
  - /api/aggregator/plaid/transactions/sync
  - /api/aggregator/plaid/transactions/clean
  - /plaid/webhook (legacy logger/forwarder)

---

## 1. Robust Error Handling

**Findings:**

- Most API routes use try...catch blocks for top-level error handling, but some downstream async calls (e.g., DB operations, fetches) are not always wrapped, risking unhandled promise rejections.
- Some error handling is inconsistent: errors are sometimes logged and sometimes only returned to the client.
- Some routes (especially legacy or internal-only) may not catch all thrown errors, risking serverless function crashes or noisy logs.

**Recommendations:**

- Ensure every API route and all major downstream async calls are wrapped in try...catch.
- Use a helper for error wrapping to reduce boilerplate and ensure consistency.
- Consider a global error boundary for API routes (middleware or utility).

**Example:**

```typescript
// filepath: src/lib/api/errorHandler.ts
export async function withErrorHandling(fn) {
  try {
    return await fn();
  } catch (error) {
    console.error("[api-error]", error);
    return new Response(
      JSON.stringify({
        code: "internal_error",
        message: "An unexpected error occurred.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
```

---

## 2. Non-sensitive Error Responses

**Findings:**

- Some API routes return detailed error messages (including error text from DB or third-party APIs) directly to the client.
- Stack traces and sensitive error details are sometimes logged to the console, which is acceptable for dev but should be filtered in production.

**Recommendations:**

- Always return generic error messages to the client (e.g., "An unexpected error occurred.").
- Log detailed errors server-side only.
- Use environment checks to control log verbosity (e.g., only log stack traces in development).

**Example:**

```typescript
// In API route
if (process.env.NODE_ENV === "production") {
  console.error("[api-error]", error.message);
} else {
  console.error("[api-error]", error);
}
return NextResponse.json(
  { code: "internal_error", message: "An unexpected error occurred." },
  { status: 500 }
);
```

---

## 3. Standardized Error Responses

**Findings:**

- Error responses are not fully standardized; some routes return `{ error: ... }`, others `{ message: ... }`, and some just a string or status code.
- This inconsistency can make client-side error handling unpredictable.

**Recommendations:**

- Adopt a standard error response format for all API routes, e.g.:

  ```json
  { "code": "error_code", "message": "Human-readable message." }
  ```

- Use this format for all error responses, including validation errors, auth errors, and internal errors.

**Example:**

```typescript
return NextResponse.json(
  { code: "validation_error", message: "Missing required field: user_id" },
  { status: 400 }
);
```

---

## 4. Observability

**Findings:**

- Console logging is used for errors, but there is no evidence of integration with a production-grade error monitoring tool (e.g., Sentry, LogRocket, Datadog).
- No structured logging or correlation IDs for tracing errors across requests.

**Recommendations:**

- Integrate Sentry (or similar) for error and exception tracking in production.
- Add request IDs or correlation IDs to logs for easier debugging.
- Use structured logs (JSON) for error events in production.

**Example:**

```typescript
// filepath: src/lib/api/sentry.ts
import * as Sentry from "@sentry/nextjs";
Sentry.init({ dsn: process.env.SENTRY_DSN });

// In API route
Sentry.captureException(error);
```

---

## Checklist (Error Handling & Logging)

- [ ] All API routes and major downstream calls wrapped in try...catch
- [ ] Only generic error messages returned to clients
- [ ] Standardized error response format used everywhere
- [ ] Sensitive error details only logged server-side
- [ ] Sentry (or similar) integrated for production error tracking
- [ ] Add request/correlation IDs to logs for traceability

---

## Error Handling & Logging Scoring Rubric and Grade (Appended)

### Rubric (Total 10 points)

| Category | Max | Description |
|---|---:|---|
| 1. Robust Try/Catch Coverage & Propagation | 2.5 | All routes and major async operations wrapped; errors propagated with context; no unhandled promise rejections. |
| 2. Standardized Error Responses | 2.0 | Consistent JSON contract (e.g., `{ code, message }`), validation errors differentiated, predictable HTTP status codes. |
| 3. Sensitive Info Handling | 1.5 | Generic client-facing messages; no secrets/PII in responses or logs; environment-based log redaction. |
| 4. Observability & Monitoring | 2.0 | Centralized error tracking (Sentry/Datadog), correlation/request IDs, structured logs, alerting. |
| 5. Consistency & Documentation | 0.5 | Route-level conventions documented; helpers used uniformly across routes. |
| 6. Error Classification & Codes | 0.5 | Clear error taxonomy (validation/auth/conflict/rate-limit/internal) with stable `code` values. |
| 7. Testability & Error-Path Tests | 1.0 | Core logic extracted to testable modules; unit tests cover error paths and edge cases. |

### Scoring (based on current report findings)

- 1. Robust Try/Catch Coverage (2.5 max): 1.2  
  Some top-level try/catch present, but downstream async operations lack coverage; risk of unhandled rejections.
- 2. Standardized Error Responses (2.0 max): 0.8  
  Mixed patterns (`{error}`, `{message}`, raw text). Standard contract not yet applied.
- 3. Sensitive Info Handling (1.5 max): 0.8  
  Guidance to keep messages generic; some payload logging persists; needs redaction controls.
- 4. Observability & Monitoring (2.0 max): 0.3  
  Console logs only; no Sentry/centralized monitoring; no correlation IDs/structured logs.
- 5. Consistency & Documentation (0.5 max): 0.3  
  Conventions proposed, not implemented uniformly.
- 6. Error Classification & Codes (0.5 max): 0.4  
  Suggested taxonomy (`validation_error`, `internal_error`) but not enforced across routes.
- 7. Testability & Error-Path Tests (1.0 max): 0.3  
  Logic embedded in routes reduces unit-testability; extraction to `lib/` pending.

### Total Score

- Awarded: 1.2 + 0.8 + 0.8 + 0.3 + 0.3 + 0.4 + 0.3 = **4.1 / 10**  
- Grade: **4.1 / 10** (Foundational patterns identified; needs implementation and enforcement)

### Priority Remediations (Top 6

1. Introduce `withErrorHandling` wrapper and apply to all route handlers; ensure downstream async calls are wrapped or awaited within guarded blocks.
2. Standardize error responses to `{ code, message }` with consistent HTTP status codes; add a small error taxonomy.
3. Integrate Sentry (or equivalent) and add `x-request-id` correlation IDs in middleware; switch to structured JSON logs in production.
4. Redact sensitive fields by default; replace full payload logs with summaries (counts/ids); use env-driven verbose logging in development only.
5. Extract core logic from routes into `src/lib` modules to enable unit tests for error paths; add 2–3 focused tests for critical flows (webhook, sync, clean).
6. Document and enforce conventions via shared helpers (validator, errors, auth); add lightweight lint rules or PR checklist to keep consistency.

---

**Next:**

- Part 4: Developer workflow & observability (metrics, error budgets, dashboards)
