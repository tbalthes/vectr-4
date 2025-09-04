# Transaction Processing API

## Overview

The transaction processing system handles batch processing of bank transactions, enriching them with merchant and category data. This system uses in-memory caching for high performance and provides both processing-only and persistence endpoints.

## Core Endpoint

### POST `/transactions/process-upload-local`

**Purpose:** Process a batch of bank transactions and enrich them with merchant/category data without persisting to database.

**URL:** `POST http://127.0.0.1:8000/transactions/process-upload-local`

#### Request Format

```json
{
  "account_id": "string",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "transaction_number": "string",
      "description": "string",
      "amount": 123.45,
      "balance": 1000.0
    }
  ]
}
```

**Required Fields:**

- `account_id`: Account identifier (string)
- `date`: Transaction date in YYYY-MM-DD format
- `transaction_number`: Unique transaction identifier
- `description`: Raw transaction description from bank
- `amount`: Transaction amount (negative for debits)

**Optional Fields:**

- `balance`: Account balance after transaction (pass-through)
- Any custom fields (preserved in output)

#### Processing Pipeline

For each transaction, the system performs:

1. **Cleaning & Normalization**

   - Uppercase description, remove special characters
   - Normalize whitespace and punctuation
   - Validate date and amount formats

2. **High-Confidence Regex Matching**

   - Match against `global_regex_rules` table
   - Extract merchant and category from matched rules
   - Set confidence to 1.0, match_method to `global_regex`

3. **Fallback Processing**

   - Use MCC (Merchant Category Code) mapping
   - Apply heuristic parsing for merchant names
   - Set lower confidence levels

4. **Data Enrichment**
   - Attach merchant metadata (ID, name, logo)
   - Add category information (ID, name, icon)
   - Include matching confidence and method

#### Response Format

```json
[
  {
    "date": "2024-08-01",
    "transaction_number": "TXN001",
    "description": "COFFEE SHOP",
    "amount": -4.5,
    "balance": 995.5,
    "merchant_id": "uuid",
    "merchant_name": "Local Coffee Shop",
    "category_id": "uuid",
    "category_name": "Dining",
    "confidence": 0.95,
    "match_method": "global_regex",
    "full_merchant_data": { "logo_url": "...", "... ": "..." }
  }
]
```

## Special Features

### Cache Refresh Trigger

Send a transaction with `original_description` set to `"REFRESH DATA TABLES"` to trigger cache refresh.

### Data Table Status

Use `GET /data-table-status/` to check cache health:

```json
{
  "last_refresh": "2024-08-16T18:00:00.000000",
  "last_refresh_phoenix": "2024-08-16T11:00:00.000000",
  "global_regex_rules_count": 42,
  "mcc_category_map_count": 120,
  "categories_count": 18
}
```

## Frontend Integration

### Upload Flow

1. **CSV Upload** (`CSVUploader.tsx`)

   - Parse CSV client-side
   - Map columns to required fields
   - Send to processing endpoint

2. **Processing Response**

   - Receive enriched transactions
   - Format for UI using `formatApiDataForUI`
   - Update page state

3. **Display** (`TransactionTable.tsx`)
   - Render processed transactions
   - Support search/filter operations
   - Handle pagination and infinite scroll

### Data Flow

```
CSV File → Parse → Column Mapping → API Call → Enrichment → UI Format → Display
```

## Error Handling

- **Invalid date formats**: Returns validation error
- **Missing required fields**: Returns 400 with field details
- **Processing errors**: Individual transaction errors don't fail entire batch
- **Cache errors**: Fallback to basic processing without enrichment

## Performance Considerations

- **In-memory caching**: All lookup tables cached for speed
- **Batch processing**: Handle multiple transactions per request
- **Thread safety**: Cache uses locks for concurrent access
- **Memory usage**: Monitor cache size in production

## Related Documentation

- [Data Cache System](../features/data-cache.md) - Caching implementation
- [Categories API](./categories.md) - Category management
- [Merchants API](./merchants.md) - Merchant data
- [Database Schema](../system/database-schema.md) - Table structures

---

_Updated: September 1, 2025_
