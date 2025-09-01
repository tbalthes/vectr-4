## Vectr AI (VECTR-AI) — Architecture & Implementation

This document describes the Vectr AI subsystem: how the AI planner is used to determine internal analytics calls, how those calls are validated and executed, how data is summarized for the model, and how the client and server stream responses. It is intended for developers who need to understand, maintain, or extend the AI orchestration pipeline.

---

## Goals

- Enable a model-driven "planner" to request internal analytics required to answer a user's question.
- Execute only validated, whitelisted internal API calls on behalf of an authenticated user.
- Summarize returned numeric results into a concise, human-readable DATA SUMMARY so downstream models can cite exact numbers without re-parsing complex JSON.
- Stream progress/debug info and the model's answer to the client as newline-delimited JSON chunks.
- Prevent abuse by enforcing strict validation and per-user quotas (development: in-memory limiter).

## High-level flow

1. Client sends a request to `POST /api/ai/chat` with a plain-text `message` and optional chat `history`.
2. Server starts a short-lived planner conversation with the configured generative model (Gemini) and instructs it to return a single JSON object listing the analytics requests it needs.
3. Server parses and validates the planner's JSON output using robust heuristics and `validatePlannerRequests()`.
4. The server normalizes planner parameters (e.g., maps `180d` → `6M`, `365d` → `1Y`) and expands aggregator requests to include canonical broader ranges (`3M`, `6M`, `1Y`) when helpful.
5. The server enforces quota via `checkPlannerQuota()`; if over quota, analytics fetches are skipped and annotated in `fetchSummary`.
6. If the incoming request forwarded authentication (cookies or authorization header), the server forwards those credentials when calling internal analytics endpoints (`/api/analytics/aggregator`, `/api/analytics/categories`, etc.). If no auth is forwarded, analytics are skipped and the client is informed.
7. Successful analytics responses are collected as `gatheredData`. The server runs helper summarizers (`summarizeAggregator`, `summarizeCategories`) to build a compact `DATA SUMMARY` containing totals, averages, transaction counts, and top categories.
8. The server starts a final model chat with the DATA SUMMARY and other instructions that force the model to use the labeled numbers and compare ranges precisely.
9. The server streams an initial debug JSON line (requestsCount, fetchSummary, quota) followed by newline-delimited JSON chunks of `{ content: "<text chunk>" }`. The stream ends with `{ done: true }`.

## Key files (where to look)

- `src/app/api/ai/chat/route.ts` — main orchestration: planner stage, validation, normalization/expansion, fetch orchestration, summarization, and streaming response format.
- `src/lib/analytics/validate-planner.ts` — validation utilities and in-memory quota logic.
- `src/lib/analytics/calculateDateRange.ts` — canonical named ranges supported by analytics endpoints (`7d`, `30d`, `90d`, `1M`, `3M`, `6M`, `YTD`, `1Y`, `all`). Normalization maps planner tokens to these values.
- `src/app/api/analytics/aggregator/route.ts` and `src/app/api/analytics/categories/route.ts` — internal analytics endpoints that require request-scoped Supabase auth.
- `src/app/private/vectr-ai/page.tsx` — client chat UI: sends `credentials: 'include'` and consumes streaming newline-delimited JSON; parses the first debug line into `dbStatus` for UX.
- `src/contexts/ChatContext.tsx` and `src/components/ai/chat-sidebar.tsx` — UI behavior improvements for session selection and title handling.

## Planner JSON contract

The planner is asked to return a single JSON object inside a ```json code fence with the shape:

```
{
  "requests": [
    { "endpoint": "aggregator", "params": { "range": "90d", "namesOnly": false } },
    { "endpoint": "categories", "params": { "namesOnly": false } }
  ]
}
```

- `endpoint` must be one of the whitelisted internal endpoints: `aggregator`, `categories`, `balances`, `transactions`.
- `params` allowed keys vary by endpoint (e.g., `range`, `start`, `end`, `namesOnly`, `limit`). The server validates shapes.

Server-side heuristics will attempt to extract JSON reliably even when the planner outputs extra text (attempts: direct parse, substring between `{}` braces, code-fence extraction). If extraction fails, the server retries with a stricter prompt instructing the planner to return only the JSON inside a fenced `json` block.

## Range normalization & expansion

- The analytics endpoints accept canonical range tokens only (see `calculateDateRange.ts`).
- The server will normalize common planner tokens using a small mapping, for example:
  - `180d` → `6M`
  - `365d` / `1y` → `1Y`
  - `6months` → `6M`
- If the planner requests `aggregator` data, the server will automatically ensure the request set includes broader canonical windows (`3M`, `6M`, `1Y`) to give the model multi-range context for trend comparisons.

## Authentication and auth forwarding

- Internal analytics endpoints require per-request Supabase auth (RLS). The server expects either cookies or a bearer token forwarded from the client request.
- The client UI must run in an authenticated browser session and include `credentials: 'include'` when calling `POST /api/ai/chat` so the server can forward the cookie to internal analytics calls.
- If no credentials are forwarded (e.g., CLI test without cookies), the server will mark analytics fetches as `skipped` with reason `no_auth_forwarded` and still provide the planner debug line so the client can explain why numbers are missing.

## Quotas and rate-limiting

- A lightweight in-memory quota (`checkPlannerQuota`) prevents runaway planner usage in development. The server annotates the initial debug JSON with quota info.
- For production, swap the in-memory store for a distributed store (Redis or DB) to ensure correctness across multiple instances.

## Data summarization

- The server converts fetched analytics JSON into short, labeled numeric summaries to make it easy for the model to reference exact numbers. Examples of summarized items:
  - totalIncome, totalSpending, totalTx, start/end dates, avgMonthlyIncome, avgMonthlySpending
  - Top categories: names and amounts (top 5)
- Summaries are provided to the final model prompt as `DATA SUMMARY` and models are explicitly instructed to use those labeled numbers when drawing conclusions.

## Streaming format

- The server uses a streaming response (text/plain, chunked) populated with newline-delimited JSON lines.
- First chunk: debug JSON, e.g. { "debug": { requestsCount, fetchSummary, quota }}\n
- Subsequent chunks: JSON objects like { "content": "<text chunk>" }\n
- Final chunk: { "done": true }\n
This allows the client to show immediate visibility into planner actions and incremental model output.

## Example fetchSummary (shape)

```
[{
  label: 'A',
  endpoint: 'aggregator',
  params: { range: '90d' },
  status: 'ok' | 'failed' | 'skipped',
  reason?: 'no_auth_forwarded' | 'planner_quota_exceeded' | 'http_401' | ...
}]
```

## Debugging tips

- If analytics are consistently skipped in the browser:
  1. Verify the user is signed in and `POST /api/ai/chat` is called from the authenticated browser.
  2. Confirm the client uses `fetch(..., { credentials: 'include' })` (see `src/app/private/vectr-ai/page.tsx`).
  3. Check the server logs in `aggregator` route for the dev-only boolean flags indicating if cookie/auth header was detected.
- If planner returns non-JSON:
  - Check the planner snippet in server logs (the code tries several extraction heuristics). If the planner consistently fails, consider further constraining the planner prompt or using a small deterministic model for planning.
- If you see `Bad Request` errors related to ranges:
  - Ensure the planner's range tokens or the server's normalization map match the canonical tokens in `src/lib/analytics/calculateDateRange.ts`.

## Security considerations

- Never log full cookies, tokens, or any sensitive PII. The current dev-only logging uses boolean indicators (hasCookie/hasAuthHeader) to avoid exposing secrets.
- Forwarding cookies to internal endpoints is done server-side only; the server must never echo secrets back to the client.
- The planner's requested endpoints are validated and whitelisted to avoid arbitrary internal calls.

## Known limitations & recommended improvements

- Quota persistence: replace in-memory quota with Redis/DB for production.
- Planner determinism: the planner is still a generative model — for higher reliability consider switching the planner to a smaller deterministic model or enforcing JSON via a synthesis/validation microservice.
- Analytics token handling: if new range tokens are introduced, update the server normalization map and `calculateDateRange` accordingly.
- Tests: more unit/integration tests for validate-planner, normalization, dedupe, and summarizers should be added and wired into CI.

## Developer checklist for changes

- [ ] Reproduce end-to-end with a signed-in browser session and confirm `DATA SUMMARY` is populated.
- [ ] Replace in-memory quota with Redis-backed limiter (if deploying multi-instance).
- [ ] Add unit tests for planner validation and range normalization.
- [ ] Add a feature flag to gate dev-only auth logs.

## Appendix — quick developer commands

Run local POST test (note: CLI tests will not forward browser cookies):

```pwsh
node -e "const http=require('http');const data=JSON.stringify({message:'Please produce a planner to fetch analytics for trends over 90d, 180d, and 365d.'});const opts={method:'POST',port:3000,hostname:'localhost',path:'/api/ai/chat',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}};const req=http.request(opts,res=>{console.log('status',res.statusCode);res.setEncoding('utf8');res.on('data',d=>process.stdout.write(d));res.on('end',()=>console.log('\n---END---'));});req.on('error',e=>console.error('err',e));req.write(data);req.end();"
```

To run the app locally (frontend dev server and backend API are part of the Next.js process):

```pwsh
npm run dev
# or if you want to start Python backend for separate Python services (if present)
cd python
. .venv/Scripts/Activate.ps1
python -m uvicorn app.main:app
```

## Contact points in code

- To change the planner prompt or extraction heuristics: edit `src/app/api/ai/chat/route.ts`.
- To adjust allowed endpoints or quota behavior: edit `src/lib/analytics/validate-planner.ts`.
- To change analytics date ranges or add support for new tokens: edit `src/lib/analytics/calculateDateRange.ts` and update normalization map in `chat/route.ts`.

---

This document should be kept close to the code and updated as the planner pattern, validation rules, or analytics APIs evolve.
