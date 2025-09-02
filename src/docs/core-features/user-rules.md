# Task 1.4 — Custom Rules Management System (WBS)

Goal: UI and APIs for creating and managing user_rules that automatically categorize transactions.

Scope overview

- Backend (FastAPI, python/) — extend `user_rules` router: CRUD, preview, retroactive application, priority management, conflict resolution, validation, tests.
- Frontend (Next.js, src/) — Rule Builder component, Rules list/management page, preview UX, bulk ops, import/export, basic performance metrics.
- Optional Next.js API routes (src/app/api/user-rules) — for SSR-friendly access (Supabase RLS) or proxy to FastAPI where logic already exists.

Assumptions

- Source of truth for rule matching is in Python: `core.transaction_processor._match_by_user_rules` and `python/app/routers/user_rules.py` (preview exists).
- Database table `user_rules` exists with fields: user_id, match_field, match_operator, match_value, category_id, priority, enabled; extend to include amount/date filters and description.
- Auth: Use Supabase session (RLS) for Next.js routes; FastAPI receives `user_id` explicitly for now.

---

## 1.4.1 User Rules API Enhancement (Backend: FastAPI)

Deliverables

- Extend python `app/routers/user_rules.py` with full CRUD and management endpoints.
- Keep preview endpoint as canonical logic; add batch apply and reordering.
- Validation, error handling, and tests.

Endpoints (FastAPI)

- GET /user_rules
  - Query params: user_id (uuid, required), search (str), enabled (bool), page/page_size, order_by (priority|created_at), order (asc|desc)
  - Returns: list of rules, total count, paging meta
- POST /user_rules
  - Body: UserRuleCreate (existing) extended with amount_min, amount_max, date_from, date_to, description
  - Behavior: server sets created_at, updated_at; validate field/operator/value; assign default priority if missing (max+10)
- PUT /user_rules/{rule_id}
  - Body: partial update (enabled, priority, match\_\*, category_id, filters, description)
- DELETE /user_rules/{rule_id}
  - Soft-delete optional; else hard delete
- POST /user_rules/preview (exists)
  - Keep as-is; ensure response contains: would_override_count, matching sample, total scanned, rule_summary
- POST /user_rules/apply-retroactive
  - Body: { user_id, rule_ids?: string[], apply_all?: boolean, dry_run?: boolean, limit?: number, date_range?: {from?, to?} }
  - Behavior: evaluate rules against user transactions; on dry_run return counts and sample; on apply write category updates and needs_review=false (configurable)
  - Safety: rate limit; chunk updates; return job id if long-running (future); for MVP run inline with limit (e.g., 5k)
- POST /user_rules/reorder
  - Body: { user_id, order: Array<{id, priority}> }
  - Behavior: bulk update priorities in a transaction to avoid conflicts

Validation & conflict resolution

- Allowed fields: description, clean_description, merchant_name, original_description, amount
- Operators: equals, contains, startswith, endswith, regex, greater_than, less_than (for amount/date where applicable)
- First-match-wins by priority (ascending). Rules with same priority: stable order by updated_at.
- Regex compiled/validated in create/update/preview; reject invalid patterns.

Data model updates (SQL)

- Add columns if missing: amount_min numeric, amount_max numeric, date_from date, date_to date, description text, created_at timestamptz, updated_at timestamptz.
- Indexes: (user_id, priority), (user_id, enabled), partial on enabled=true for list page.

Tests (python/tests)

- Unit: preview matching for all operators and fields; priority tie-break; amount/date filters; would_override_count correctness.
- Integration: create/update/delete; reorder; apply-retroactive dry-run and limited apply (use temp fixtures or mock Supabase client).

---

## 1.4.2 Rule Builder UI Component (Frontend)

Deliverables

- `src/components/private/rules/RuleBuilder.tsx` — self-contained builder.
- `RulePreviewPanel.tsx` — render preview results with counts and sample matches.
- Lightweight schema/types in `src/types/rules.ts`.

RuleBuilder details

- Inputs
  - Field select: original_description, clean_description, merchant_name, amount
  - Operator select: equals, contains, startswith, endswith, regex, greater_than, less_than (only show numeric ops for amount)
  - Value inputs: text/number; helper for regex testing
  - Optional filters: amount_min/max, date_from/to
  - Category assignment: reuse CategoryTreePicker (single select)
  - Priority number input; Enabled toggle
  - Description (free text)
- Actions
  - Preview button: calls POST /api/user-rules/preview (proxy) with current form; show `RulePreviewPanel` (list of TransactionMatch with override indicator)
  - Save button: POST /api/user-rules (create) or PUT /api/user-rules/:id (update)
  - Reset/Cancel
- UX details
  - Validation: inline error states for missing field/operator/value/category; regex compile errors; numeric validation for amount filters
  - Accessibility: labels, keyboard navigation
  - Loading/saving states with toasts

Contracts (types)

- UserRule: id, user_id, match_field, match_operator, match_value, category_id, priority, enabled, amount_min?, amount_max?, date_from?, date_to?, description?, created_at, updated_at
- RulePreviewResponse (matches FastAPI): rule_summary, total_transactions_checked, matching_transactions[], would_override_count, sample_limit_reached
- TransactionMatch: transaction_id, date, description, clean_description?, merchant_name?, amount, current_category_name?, matched_category_name?, confidence, match_method

---

## 1.4.3 Rules Management Interface (Frontend)

Deliverables

- Route: `src/app/private/rules/page.tsx` with:
  - RulesList table: columns (enabled, priority, field/operator/value, category, description, updated_at, matches last 30d [optional])
  - Search/filter toolbar: text search; enabled filter; field/operator filters
  - Bulk actions: enable/disable; delete; export
  - Drag-and-drop reordering of priority with save (POST /api/user-rules/reorder)
  - “New Rule” opens RuleBuilder; “Edit” inline drawer using RuleBuilder
  - “Preview” inline action shows RulePreviewPanel
- Import/Export
  - Export selected/all rules as JSON
  - Import JSON -> validate -> create in batch (client-side preview before POST)
- Performance metrics (MVP)
  - For each rule: count of matching transactions in last 30d (computed via preview or small RPC); display as badge

State & data access

- Hooks
  - `useUserRules` — list, create, update, delete, reorder, preview
  - Backed by Next.js API routes with Supabase RLS or proxy to FastAPI
- Optimistic updates for enable/disable and reorder

---

## Next.js API (optional/proxy layer)

- Create `src/app/api/user-rules` route handlers (or proxy to FastAPI):
  - GET /api/user-rules -> supabase.from('user_rules').select(...).eq('user_id', session.user.id)
  - POST /api/user-rules -> insert
  - PUT /api/user-rules/[id] -> update
  - DELETE /api/user-rules/[id]
  - POST /api/user-rules/preview -> proxy to FastAPI `/user_rules/preview?user_id=...`
  - POST /api/user-rules/reorder -> bulk update priorities
  - POST /api/user-rules/apply-retroactive -> proxy to FastAPI
- Use `createRouteHandlerClient({ cookies })` pattern to avoid dynamic API warnings.

---

## Integration touchpoints

- TransactionDetailsDrawer: “Create Rule from this transaction”
  - Prefill builder: field=clean_description, operator=contains, value=transaction.clean_description; category=current or chosen
  - 1-click preview
- AdvancedFilters: later diagnostics for “rules matching” (optional)

---

## Security & permissions

- Enforce user isolation (RLS on user_rules). Scope all queries by session.user.id.
- FastAPI: continue requiring `user_id` with UUID validation; consider signed requests between Next.js and FastAPI.

---

## Milestones & acceptance criteria

- M1 — Backend CRUD + Preview stable: endpoints implemented with tests; preview parity with matcher
- M2 — Rule Builder shipped: build/validate/preview/save flows; CategoryTreePicker integrated
- M3 — Rules Management page: list/search/filter/reorder/bulk enable-Disable; inline preview
- M4 — Retroactive apply (MVP): dry-run + limited apply with progress reporting

---

## Estimates (t-shirt sizes)

- Backend endpoints & tests: L
- Next.js API routes (proxy + CRUD): M
- RuleBuilder + preview panel: M
- Rules list page + DnD reorder + bulk ops: M-L
- Import/export JSON: S
- Retroactive apply (MVP): M-L

---

## Dependencies

- CategoryTreePicker (ready)
- Supabase auth/session in Next.js routes (cookies pattern fixed)
- DB migrations for new columns/indexes

---

## Risks & mitigations

- Regex performance/DoS: limit pattern length; reject catastrophic patterns; validate pre-compilation.
- Retroactive mass-updates: batch sizes and limits; dry-run first; background jobs later.
- Priority conflicts: enforce unique ordering per user or stable secondary sort by updated_at.

---

### Appendix — What already exists

- FastAPI
  - `python/app/routers/user_rules.py` includes RulePreview and CategoriesTree endpoints utilizing `_match_by_user_rules` and `data_cache`.
- Frontend
  - CategoryTreePicker component ready for category assignment
  - Transactions UI + TransactionDetailsDrawer integration points
