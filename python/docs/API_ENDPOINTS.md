# API Endpoint Documentation

## 1. `/transactions/process-upload-local` (POST)

**Purpose:**  
Process a batch of bank transactions, enrich them with merchant/category data, and return the results. This endpoint does not write to the database.

**URL:**  
`POST http://127.0.0.1:8000/transactions/process-upload-local`

**Request Body:**
```json
{
  "account_id": "string",           // Required. The account identifier for these transactions.
  "transactions": [
    {
      "date": "YYYY-MM-DD",         // Required. Transaction date.
      "transaction_number": "str",  // Required. Unique transaction number.
      "description": "string",      // Required. Transaction description.
      "amount": 123.45,             // Required. Transaction amount.
      "balance": 1000.00,           // Optional. Account balance after this transaction (pass-through).
      // ...any other custom fields (allowed and preserved)
    }
    // ...more transactions
  ]
}
```

**Behavior:**
- Each transaction is cleaned and normalized.
- The description is matched against in-memory regex rules for merchant/category enrichment.
- Fallback logic uses MCC and parsing if no regex match.
- All lookups use in-memory cached tables for performance.
- The `balance` field is passed through unchanged if present.
- Any extra fields in the input are preserved in the output.

**Response:**
Returns a list of processed transactions, each including:
- All original fields (including `balance` if present)
- Enriched fields: `merchant_id`, `merchant_name`, `category_id`, `category_name`, `confidence`, `match_method`, etc.

**Example Response:**
```json
[
  {
    "date": "2024-08-01",
    "transaction_number": "TXN001",
    "description": "COFFEE SHOP",
    "amount": -4.50,
    "balance": 995.50,
    "merchant_id": "...",
    "merchant_name": "...",
    "category_id": "...",
    "category_name": "...",
    "confidence": 1.0,
    "match_method": "global_regex"
    // ...any custom fields
  }
]
```

**Special Feature:**  
If any transaction in the batch has `"original_description": "refresh data tables"` (or similar trigger), the in-memory cache of lookup tables will be refreshed from Supabase before processing.

---

## 2. `/data-table-status/` (GET)

**Purpose:**  
Report the status of the in-memory data tables used for transaction processing, including last refresh time and row counts.

**URL:**  
`GET http://127.0.0.1:8000/data-table-status/`

**Response:**
```json
{
  "last_refresh": "2024-08-16T18:00:00.000000",
  "global_regex_rules_count": 42,
  "mcc_category_map_count": 120,
  "categories_count": 18
}
```

**Fields:**
- `last_refresh`: UTC timestamp of the last time the lookup tables were loaded/refreshed from Supabase.
- `global_regex_rules_count`: Number of regex rules currently cached.
- `mcc_category_map_count`: Number of MCC-category mappings cached.
- `categories_count`: Number of categories cached.

**Usage:**  
- Use this endpoint to monitor the health and freshness of your in-memory lookup tables.
- Useful for debugging, development, and ensuring that recent changes in Supabase are reflected in your API.

---

**See also:**  
- [TRANSACTION_PROCESSING_API.md](./TRANSACTION_PROCESSING_API.md) for more details on transaction enrichment logic.
- [data_cache.py](./data_cache.py) for
  more information about the in-memory lookup/cache implementation.

---

## End-to-end transaction processing (upload → table)

This section describes the full flow for adding transactions via the UI CSV uploader through to the transaction table that the user sees. It links the frontend components, API endpoints, and backend processing logic so you can trace a transaction from upload to render.

High-level flow:

- User uploads CSV (+ Add transaction → CSV uploader component)
- Client parses CSV and (optionally) asks the user to map columns
- Client sends parsed transactions to the processing endpoint
- Backend (Python FastAPI) normalizes, enriches, and returns processed transactions
- Frontend receives processed transactions, formats them for UI and stores them in page state
- Search/filter controls and the TransactionTable component render the results

### 1) Upload (frontend)

- UI entrypoint: `src/components/private/csv-uploader/CSVUploader.tsx` and related steps (`ColumnMappingStep.tsx`, `csv-utils.ts`).
- What happens:
  - User clicks “+ Add transaction” which opens the CSV uploader UI.
  - The file is read (client-side) and parsed into rows (CSV parsing utilities in `csv-utils.ts`).
  - The UI presents a column-mapping step so the user can tell the app which CSV column maps to `date`, `transaction_number`, `description`, `amount`, etc.
  - The uploader constructs a JSON payload with the mapped fields and any extra columns preserved.

Example payload shape sent by the frontend (same shape expected by the processing endpoint):

```json
{
  "account_id": "string",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "transaction_number": "TXN-001",
      "description": "Some merchant text",
      "amount": -12.34,
      "balance": 1000.00,
      "original_description": "raw csv description",
      "custom_column": "kept"
    }
  ]
}
```

Notes:
- The frontend preserves any extra columns and sends them through so backend processing doesn't drop fields.
- Column mapping is optional for developer testing; automatic column heuristics are often used for common provider CSVs.

### 2) Processing (backend)

- Endpoint(s):
  - Development-only/process endpoint: `POST http://127.0.0.1:8000/transactions/process-upload-local` (documented above). This processes batches and returns enriched results without writing to the DB.
  - Production/ingest endpoints may exist under `python/app/` (check `main.py` and routers). Frontend also uses a Next.js API proxy at `/api/transactions` to fetch stored transactions.

- Core logic files:
  - `python/core/parser.py` — description cleaning, normalization, date/amount parsing
  - `python/core/matching.py` — merchant/category matching using regex rules, MCC maps, fuzzy heuristics
  - `python/data_cache.py` (or similar) — in-memory cache of global regex rules, mcc maps, categories; used to avoid repeated DB hits

- Processing steps per transaction:
  1. Normalize fields (trim, uppercase/lowercase as required, normalize whitespace/punctuation).
  2. Parse/format `transaction_number` and `date` and ensure `amount` is numeric.
  3. If a special trigger is present (for example, a transaction with `original_description` == "refresh data tables"), refresh the in-memory cache from Supabase before processing the batch.
  4. Attempt merchant/category enrichment in order of preference:
     - Global regex rules (highest confidence, exact pattern matches)
     - MCC -> category mapping (fallback for ATM/merchant-less rows)
     - Fuzzy string heuristics / parsed merchant name
  5. Attach metadata to the returned transaction: `merchant_id`, `merchant_name`, `category_id`, `category_name`, `confidence`, `match_method`, `full_merchant_data` (optional), and preserve any custom fields.

- Response: an array of processed transactions (same order as input) including all original fields plus the enrichment metadata. The example response is shown earlier in this document.

### 3) Persisting vs returning

- The `process-upload-local` endpoint is intended for previewing / testing and does not persist changes.
- A separate ingest endpoint (or the production flow) will persist results into Supabase; the exact API path will be under your backend router or Next.js API route depending on deployment.

### 4) Frontend: receiving processed transactions and rendering

- Page entrypoint: `src/app/private/transactions/page.tsx`.
- Typical flow on the page:
  1. On mount (or after a successful upload/ingest), the page fetches transactions from the app API: `fetch('/api/transactions')` (this endpoint returns stored transactions from Supabase when not in the local-preview flow).
  2. Raw API entries are normalized into the front-end UI format using `formatApiDataForUI` (defined in `page.tsx` or `src/lib/` utilities). This maps backend fields to `FormattedTransaction` shape the UI expects.
  3. The page stores the UI-ready array in React state via `const [transactions, setTransactions] = useState<FormattedTransaction[]>([])`.
  4. A search component (`TransactionSearch` moved into the header, or the original `SearchFilterControls`) consumes `transactions` and emits a filtered array via a callback `onFilteredChange`.
  5. The page keeps `filteredTransactions` state which is the input to the rendering table.
  6. The rendering component used is the enhanced table: `src/components/private/transactions/enhanced_table/TransactionTable.tsx`. This component:
     - Accepts `transactions: FormattedTransaction[]` and `onEdit` / `onDelete` callbacks
     - Maintains local state for infinite-scroll pagination (`displayedTransactions`) and `filteredAndSortedTransactions` for local filtering/sorting
     - Updates its internal lists when the parent `transactions` prop changes (there is an effect which copies the prop into local state and resets the displayed slice)
     - Renders the visible slice and supports loading more items via intersection observer or pagination controls

Key UI files: `SearchFilterControls.tsx`, `transaction-search.tsx`, `enhanced_table/TransactionTable.tsx`, `TransactionRow.tsx`.

### 5) Search & Filter interaction details

- Two search/filter paths exist and were intentionally kept separate:
  - `SearchFilterControls` — full-featured controls that own search/filter/sort/pagination state and can emit paginated slices to the parent.
  - `TransactionSearch` — a lightweight header search input that copies the exact search logic from `SearchFilterControls` and emits a filtered array via `onFilteredChange`.

- Parent `page.tsx` responsibility:
  - Maintain the canonical `transactions` array (source-of-truth received from API).
  - Initialize `filteredTransactions` to `transactions` on first load.
  - Update `filteredTransactions` whenever `TransactionSearch` emits a new filtered array.
  - Pass `filteredTransactions` down to the `TransactionTable` for display.

### 6) Edge cases, performance and debugging tips

- Large files: the preview/process endpoint is synchronous; for very large CSVs consider chunked processing or background jobs.
- Cache staleness: if you change lookup tables in Supabase, send a refresh trigger (special transaction with `original_description` trigger or call the `/data-table-status/` endpoint and a refresh route) to reload in-memory tables.
- Consistency: ensure `formatApiDataForUI` maps backend field names (`merchant_name`, `category_name`, `transaction_number`, `original_description`) exactly to frontend `FormattedTransaction` fields.
- Debugging tips:
  - Add console logs where `setTransactions(formatted)` is called to confirm the UI receives the formatted array.
  - Confirm `TransactionTable` receives `filteredTransactions` by logging the prop inside `enhanced_table/TransactionTable.tsx`.
  - If transactions don't appear, check that `filteredAndSortedTransactions` is being updated when the `transactions` prop changes (there is an effect that synchronizes them).

### 7) Data shapes and types

- Input transaction (upload): see JSON payload earlier in this file.
- Processed transaction (backend response): original fields + enrichment metadata. Example keys:
  - `id` (uuid)
  - `transaction_number` (string)
  - `date` (YYYY-MM-DD)
  - `description`, `originalDescription`
  - `amount`, `balance`
  - `merchant_id`, `merchant_name`, `merchantLogoUrl`, `full_merchant_data`
  - `category_id`, `category_name`, `categoryIcon`
  - `confidence` (float 0.0–1.0)
  - `match_method` (string: `global_regex`, `mcc_map`, `fuzzy`)

### 8) Quick troubleshooting checklist

- I uploaded CSV but no rows show:
  - Confirm the uploader created a payload and the POST returned 200 with a list of processed transactions.
  - Confirm the page called `formatApiDataForUI` and `setTransactions` with a non-empty array.
  - Confirm `filteredTransactions` was initialized or updated, and the `TransactionTable` received it.

- Search returns zero results unexpectedly:
  - Verify `TransactionSearch` receives the same `transactions` array the page has.
  - Confirm the search logic matches existing `SearchFilterControls` exactly (case normalization, trimmed strings).

### 9) Next steps / improvements

- Add explicit API endpoints for ingest vs preview to make the distinction clear in the frontend UI.
- Add streaming/chunked processing for very large CSV uploads.
- Add an admin-only endpoint to force cache refresh and surface the `/data-table-status/` info in the UI.
- Add unit tests for `formatApiDataForUI`, `parser.py`, and `matching.py` to prevent regressions.

---


