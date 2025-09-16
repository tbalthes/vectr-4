PLAID MVP - Next Steps (short actionable backlog)

Immediate (1-3 days)
- Create/verify canonical `items` table with `transactions_cursor`.
- Implement JWS verification for webhook endpoint; log event IDs and persist events table.
- Implement dedupe using webhook event_id / dedupe_key.
- Implement a simple background sync worker and wire webhook handler to enqueue syncs.
- Add `/api/plaid/refresh-item` returning 202 and rate-limited.

Short (1-2 weeks)
- Fetch and persist static account metadata during `public_token` exchange.
- Audit secrets storage for access_tokens; ensure encryption and no leakage.
- Add DB indexes for `transactions(item_id, date)`.
- Implement per-user rate limit/config for manual refresh.

Medium (2-4 weeks)
- Add structured logging with request_id and basic Sentry integration.
- Write unit and integration tests for webhook/dedupe/sync flow.
- Add feature flag `PLAID_MVP_SYNC_ENABLED` and rollback docs for deploy.
- Run staging deploy and validate end-to-end Plaid webhook & sync behavior.

Notes
- Prioritize low-risk, high-value items first. Keep changes behind flags when possible.
- If Plaid rate limits are hit during testing, throttle tests and use small test accounts.
