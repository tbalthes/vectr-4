# POST /user_rules/preview Endpoint Implementation

## Overview

Implemented a comprehensive rule preview endpoint that allows users to test proposed categorization rules against their recent transactions before saving them.

## Features Implemented

### 1. Rule Preview Endpoint

- **POST `/user_rules/preview?user_id={uuid}&sample_limit={int}`**: Test rules against recent transactions
- Fetches user's recent transactions (configurable limit, default 100)
- Tests proposed rule against each transaction using existing `_match_by_user_rules` logic
- Returns detailed match results with before/after category information
- Shows statistics on potential changes and overrides

### 2. Comprehensive Validation

- **UUID validation**: user_id and category_id must be valid UUIDs
- **Operator validation**: supports equals, contains, startswith, endswith, regex
- **Field validation**: supports description, clean_description, merchant_name, original_description, amount
- **Regex validation**: tests regex patterns for validity before execution
- **Database error handling**: graceful handling of connection issues

### 3. Rich Response Data

- **Rule summary**: Human-readable description of what the rule does
- **Match statistics**: Total transactions checked, matches found, would-override count
- **Transaction details**: For each match, shows current vs new category, confidence, amounts
- **Sample limiting**: Indicates if sample limit was reached (more data available)

### 4. Test Coverage

- **14 unit tests** covering:
  - Successful rule previews with different operators
  - Amount range filtering and regex patterns
  - Validation errors (invalid UUIDs, operators, fields, regex)
  - Edge cases (no matches, database errors, missing categories)
  - Sample limiting and rule summary generation

## API Usage

### Request

```http
POST /user_rules/preview?user_id={uuid}&sample_limit=100
Content-Type: application/json

{
  "match_field": "description",
  "match_operator": "contains",
  "match_value": "WALMART",
  "category_id": "550e8400-e29b-41d4-a716-446655440010",
  "priority": 10,
  "amount_min": 20.00,
  "amount_max": 100.00
}
```

### Response

```json
{
  "rule_summary": "When description contains 'WALMART' and amount >= $20.00 and amount <= $100.00, categorize as 'Groceries'",
  "total_transactions_checked": 100,
  "matching_transactions": [
    {
      "transaction_id": "tx-uuid",
      "date": "2025-01-15",
      "description": "WALMART SUPERCENTER #1234",
      "clean_description": "WALMART SUPERCENTER",
      "merchant_name": "Walmart",
      "amount": 45.67,
      "current_category_name": "Gas",
      "matched_category_name": "Groceries",
      "confidence": 1.0,
      "match_method": "user_rule"
    }
  ],
  "would_override_count": 2,
  "sample_limit_reached": false
}
```

## Supported Rule Types

### Match Fields

- `description`: Original transaction description
- `clean_description`: Processed description
- `merchant_name`: Resolved merchant name
- `original_description`: Raw bank description
- `amount`: Transaction amount (for amount-only rules)

### Match Operators

- `equals`: Exact match (case insensitive)
- `contains`: Substring match (case insensitive)
- `startswith`: Prefix match (case insensitive)
- `endswith`: Suffix match (case insensitive)
- `regex`: Regular expression match (supports flags)

### Filters

- `amount_min`: Minimum transaction amount
- `amount_max`: Maximum transaction amount
- `priority`: Rule precedence (lower number = higher priority)

## Business Logic

### Rule Testing Process

1. Fetch recent transactions for user (ordered by date DESC, limited by sample_limit)
2. For each transaction:
   - Convert to format expected by `_match_by_user_rules`
   - Test proposed rule using existing rule matching logic
   - If match found, capture current vs new category information
   - Track whether this would override existing categorization
3. Generate human-readable rule summary
4. Return comprehensive results with statistics

### Category Override Detection

- Compares proposed category_id with transaction's current primary_category_id
- Counts transactions that would change categories as "overrides"
- Shows both current and new category names for user review

### Performance Considerations

- Configurable sample limit (default 100 transactions)
- Indicates when sample limit reached (more data available)
- Reuses existing data cache for categories and merchants
- Leverages existing rule matching logic for consistency

## Integration Points

### With Existing Code

- **Reuses `_match_by_user_rules`**: Ensures preview results match actual rule behavior
- **Uses data cache**: Categories and merchants loaded from existing cache
- **Follows FastAPI patterns**: Same dependency injection and error handling
- **Consistent validation**: Same UUID/operator validation as other endpoints

### Router Registration

- Added to `app/main.py` as `user_rules.router`
- Mounted at `/user_rules` prefix with "user_rules" tag
- Follows existing router pattern for consistency

## Files Created/Modified

### New Files

- `app/routers/user_rules.py` - Complete user rules router with preview endpoint
- `tests/test_user_rules_preview.py` - Comprehensive test suite (14 tests)

### Modified Files

- `app/main.py` - Added user_rules router registration

## Error Handling

### Validation Errors (400)

- Invalid user_id or category_id format
- Invalid match_operator or match_field values
- Invalid regex patterns (tested before execution)

### Database Errors (500)

- Transaction fetch failures
- Supabase connection issues
- Graceful fallback with meaningful error messages

### Business Logic Errors

- Missing categories in cache: Shows "Unknown Category" but continues
- No transactions found: Returns empty results (not an error)
- No matches found: Returns zero matches with statistics

## Usage Examples

### Test Simple Contains Rule

```bash
curl -X POST "http://localhost:8000/user_rules/preview?user_id=550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{
    "match_field": "description",
    "match_operator": "contains",
    "match_value": "STARBUCKS",
    "category_id": "550e8400-e29b-41d4-a716-446655440030"
  }'
```

### Test Amount Range Rule

```bash
curl -X POST "http://localhost:8000/user_rules/preview?user_id=550e8400-e29b-41d4-a716-446655440000&sample_limit=50" \
  -H "Content-Type: application/json" \
  -d '{
    "match_field": "description",
    "match_operator": "contains",
    "match_value": "GAS",
    "category_id": "550e8400-e29b-41d4-a716-446655440020",
    "amount_min": 20.00,
    "amount_max": 150.00
  }'
```

### Test Regex Rule

```bash
curl -X POST "http://localhost:8000/user_rules/preview?user_id=550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{
    "match_field": "description",
    "match_operator": "regex",
    "match_value": "(?i)(target|walmart).*#\\d+",
    "category_id": "550e8400-e29b-41d4-a716-446655440010"
  }'
```

## Next Steps

- ✅ Rule ordering bug fixed and tested
- ✅ PATCH endpoint with audit trail implemented and tested
- ✅ Rule preview endpoint implemented and tested
- 🔄 Ready for: GET `/categories/tree` endpoint (task #4)
- 🔄 Ready for: POST `/merchants` endpoint for creating merchants
- 🔄 Ready for: Retroactive rules application job (task #5)
