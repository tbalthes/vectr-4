# Transaction Processing API: Detailed Documentation

## Endpoint

**POST** `/transactions/process-upload-local`

Processes a batch of bank transactions, enriches them with merchant/category data, and returns the results (does not write to the database).

---

## Request Payload

The endpoint expects a JSON body with the following structure:

```json
{
  "account_id": "string", // The account to associate with these transactions
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "transaction_number": "string",
      "description": "string", // Raw memo/description from the bank
      "amount": 123.45,
      // ...any additional custom fields (allowed)
    },
    // ...more transactions
  ]
}
```

- `account_id`: The identifier for the account (string).
- `transactions`: An array of transaction objects. Each must include at least `date`, `transaction_number`, `description`, and `amount`. Extra fields are allowed and preserved.

---

## Processing Pipeline (What Happens Internally)

For each transaction in the `transactions` array:

1. **Cleaning & Normalization**
   - The `description` field is uppercased, special characters are removed, and whitespace is normalized.

2. **High-Confidence Regex Matching**
   - The cleaned description is matched against regex rules in the `global_regex_rules` table (Supabase).
   - If a match is found, merchant and category info are extracted from the associated merchant record.
   - Confidence is set to 1.0, and `match_method` is `global_regex`.

3. **Fallback: MCC and Heuristic Parsing**
   - If no regex match, attempts to extract a 4-digit MCC (Merchant Category Code) from the description.
   - If an MCC is found, looks up the corresponding category in the `mcc_category_map` table.
   - Attempts to parse a merchant name heuristically from the description.
   - Confidence is lower (0.7 if a name is parsed, 0.5 if not), and `match_method` is `mcc_and_parse` or `mcc_only`.

4. **Category Name Lookup**
   - If a category_id is found, fetches the human-readable category name from the `categories` table.

5. **Result Assembly**
   - The original transaction fields are preserved.
   - Enriched fields are added: merchant/category info, confidence, match method, and a `needs_review` flag (true if confidence < 0.9).
   - Any extra fields from the input are included in `user_metadata`.
   - The `account_id` from the payload is attached to each result.

---

## Example Request

```json
{
  "account_id": "acc_12345",
  "transactions": [
    {
      "date": "2025-08-15",
      "transaction_number": "TXN001",
      "description": "Starbucks #1234 MC 5814",
      "amount": 4.50
    },
    {
      "date": "2025-08-15",
      "transaction_number": "TXN002",
      "description": "ACH DEPOSIT PAYROLL",
      "amount": 1500.00
    }
  ]
}
```

---

## Example Response

Returns an array of enriched transaction objects (one per input):

```json
[
  {
    "date": "2025-08-15",
    "transaction_number": "TXN001",
    "amount": 4.5,
    "original_description": "Starbucks #1234 MC 5814",
    "user_metadata": {},
  "merchant_id": "...", // from merchant table if matched
  "category_id": "5814", // from MCC or regex rule
  "category_name": "Coffee Shops", // from categories table
  "clean_description": "Starbucks", // parsed/normalized merchant name
  "confidence": 1.0,
  "match_method": "global_regex",
  "needs_review": false,
  "account_id": "acc_12345",
  "balance": 995.50 // Pass-through from input
  },
  {
    "date": "2025-08-15",
    "transaction_number": "TXN002",
    "amount": 1500.0,
    "original_description": "ACH DEPOSIT PAYROLL",
    "user_metadata": {},
    "merchant_id": null,
    "category_id": null,
    "category_name": null,
    "clean_description": "Uncategorized",
    "confidence": 0.0,
    "match_method": "no_match",
    "needs_review": true,
    "account_id": "acc_12345"
  }
]
```

---

## Field-by-Field Explanation

- `date`, `transaction_number`, `amount`, `balance`: Copied from input (balance is pass-through).
- `original_description`: The raw description from the input.
- `user_metadata`: Any extra fields from the input transaction (not part of the standard schema).
- `merchant_id`: ID of the matched merchant (if any).
- `category_id`: ID of the matched category (from regex, MCC, or null).
- `category_name`: Human-readable category name (if found).
- `clean_description`: Parsed/normalized merchant name or fallback.
- `confidence`: Float (0.0–1.0) indicating match confidence.
- `match_method`: One of `global_regex`, `mcc_and_parse`, `mcc_only`, or `no_match`.
- `needs_review`: Boolean, true if confidence < 0.9.
- `account_id`: The account ID from the request payload.

---

## Notes
- This endpoint does not write to the database; it only returns processed results.
- The `balance` field is passed through from input to output, unchanged, if present.
- If you want to persist results, see the commented-out code in the router for an upsert example.
- The matching logic is extensible: you can add more strategies in `core/transaction_processor.py`.
- All processing is stateless and per-request; no data is cached or stored.

---

For further details, see:
- `python/app/routers/transactions.py` (API endpoint)
- `python/core/transaction_processor.py` (processing logic)
- `python/app/dependencies.py` (Supabase client dependency)
