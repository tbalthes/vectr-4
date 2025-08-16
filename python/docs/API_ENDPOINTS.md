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