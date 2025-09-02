# User Rules API

## Overview

The User Rules system allows users to create custom categorization rules that automatically assign categories to transactions based on configurable criteria. Rules are processed in priority order and support complex matching conditions.

## Core Concepts

### Rule Structure
- **Match Field**: Which transaction field to evaluate (description, merchant_name, amount, etc.)
- **Match Operator**: How to compare values (equals, contains, regex, greater_than, etc.)
- **Match Value**: The value to match against
- **Category Assignment**: Which category to assign when rule matches
- **Priority**: Execution order (lower numbers = higher priority)
- **Filters**: Optional amount and date range constraints

### Rule Processing
- Rules are evaluated in priority order (ascending: 1, 2, 3...)
- First matching rule wins (no further evaluation)
- Rules with same priority: stable order by `updated_at`
- Disabled rules are skipped

## API Endpoints

### GET `/user_rules`

List user's rules with optional filtering and pagination.

**Query Parameters:**
- `user_id` (uuid, required): User identifier
- `search` (string): Search rule descriptions and values
- `enabled` (boolean): Filter by enabled status
- `page` (integer): Page number (default: 1)
- `page_size` (integer): Items per page (default: 50)
- `order_by` (string): Sort field (`priority` | `created_at`)
- `order` (string): Sort direction (`asc` | `desc`)

**Response:**
```json
{
  "rules": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "match_field": "description",
      "match_operator": "contains",
      "match_value": "coffee",
      "category_id": "uuid",
      "priority": 1,
      "enabled": true,
      "amount_min": null,
      "amount_max": -1.00,
      "date_from": null,
      "date_to": null,
      "description": "Coffee shop purchases",
      "created_at": "2024-08-01T10:00:00Z",
      "updated_at": "2024-08-01T10:00:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "page_size": 50,
  "total_pages": 1
}
```

### POST `/user_rules`

Create a new user rule.

**Request Body:**
```json
{
  "user_id": "uuid",
  "match_field": "description",
  "match_operator": "contains",
  "match_value": "coffee",
  "category_id": "uuid",
  "priority": 10,
  "enabled": true,
  "amount_min": null,
  "amount_max": -1.00,
  "date_from": null,
  "date_to": null,
  "description": "Coffee shop purchases"
}
```

**Validation:**
- `match_field`: Must be valid field (`description`, `clean_description`, `merchant_name`, `original_description`, `amount`)
- `match_operator`: Must be compatible with field type
- `match_value`: Required, validated based on operator (regex compilation for regex operator)
- `category_id`: Must exist and belong to user
- `priority`: Auto-assigned as max+10 if not provided

### PUT `/user_rules/{rule_id}`

Update an existing rule (partial updates supported).

**Request Body:** Same as POST, all fields optional except what you want to change.

### DELETE `/user_rules/{rule_id}`

Delete a user rule permanently.

### POST `/user_rules/preview`

Preview how a rule would match against existing transactions without applying changes.

**Request Body:**
```json
{
  "user_id": "uuid",
  "match_field": "description",
  "match_operator": "contains",
  "match_value": "coffee",
  "amount_min": null,
  "amount_max": -1.00,
  "date_from": null,
  "date_to": null,
  "sample_limit": 10
}
```

**Response:**
```json
{
  "rule_summary": "description contains 'coffee'",
  "total_transactions_checked": 1500,
  "matching_transactions": [
    {
      "transaction_id": "uuid",
      "date": "2024-08-01",
      "description": "COFFEE SHOP DOWNTOWN",
      "clean_description": "COFFEE SHOP DOWNTOWN",
      "merchant_name": "Coffee Shop",
      "amount": -4.50,
      "current_category_name": "Uncategorized",
      "matched_category_name": "Dining",
      "confidence": 1.0,
      "match_method": "user_rule"
    }
  ],
  "would_override_count": 5,
  "sample_limit_reached": false
}
```

### POST `/user_rules/apply-retroactive`

Apply rules to existing transactions retroactively.

**Request Body:**
```json
{
  "user_id": "uuid",
  "rule_ids": ["uuid1", "uuid2"],
  "apply_all": false,
  "dry_run": true,
  "limit": 1000,
  "date_range": {
    "from": "2024-01-01",
    "to": "2024-08-01"
  }
}
```

**Response (dry_run=true):**
```json
{
  "total_transactions_scanned": 1500,
  "total_matches": 45,
  "rules_applied": [
    {
      "rule_id": "uuid",
      "rule_description": "Coffee shop purchases",
      "matches": 12,
      "overrides": 8
    }
  ],
  "sample_updates": [
    {
      "transaction_id": "uuid",
      "old_category": "Uncategorized",
      "new_category": "Dining",
      "rule_description": "Coffee shop purchases"
    }
  ]
}
```

**Response (dry_run=false):**
```json
{
  "total_updated": 45,
  "rules_applied": 3,
  "processing_time_ms": 234
}
```

### POST `/user_rules/reorder`

Bulk update rule priorities to change execution order.

**Request Body:**
```json
{
  "user_id": "uuid",
  "order": [
    {"id": "uuid1", "priority": 1},
    {"id": "uuid2", "priority": 2},
    {"id": "uuid3", "priority": 3}
  ]
}
```

## Match Fields & Operators

### Available Fields
- `description`: Cleaned transaction description
- `clean_description`: Further normalized description
- `merchant_name`: Extracted merchant name
- `original_description`: Raw bank description
- `amount`: Transaction amount

### Operators by Field Type

**Text Fields** (`description`, `clean_description`, `merchant_name`, `original_description`):
- `equals`: Exact match (case-insensitive)
- `contains`: Substring match
- `startswith`: Prefix match
- `endswith`: Suffix match
- `regex`: Regular expression match

**Numeric Fields** (`amount`):
- `equals`: Exact amount match
- `greater_than`: Amount greater than value
- `less_than`: Amount less than value
- `greater_than_or_equal`: Amount >= value
- `less_than_or_equal`: Amount <= value

## Rule Priority & Conflicts

### Priority Rules
1. Lower priority numbers = higher precedence (1 executes before 10)
2. Rules with same priority: stable order by `updated_at`
3. First matching rule wins - no further evaluation

### Best Practices
- Use priority 1-10 for critical/specific rules
- Use priority 100+ for broad catch-all rules
- Leave gaps (1, 10, 20) to insert rules later
- Most specific rules should have lowest priority numbers

## Frontend Integration

### Rule Builder Component
The `RuleBuilder.tsx` component provides:
- Field/operator/value selection with validation
- Category picker integration
- Real-time preview functionality
- Priority management
- Amount and date range filters

### Preview Integration
- Live preview as user types
- Sample matching transactions
- Override count warnings
- Regex validation feedback

## Error Handling

### Validation Errors
- Invalid regex patterns
- Incompatible field/operator combinations
- Missing required fields
- Invalid category references

### Runtime Errors
- Database connection failures
- Transaction processing errors
- Rate limiting on bulk operations

## Performance Considerations

- **Rule Caching**: Rules cached per user for fast evaluation
- **Batch Processing**: Retroactive application uses chunked updates
- **Index Optimization**: Database indexes on `(user_id, priority)` and `(user_id, enabled)`
- **Rate Limiting**: Retroactive operations limited to prevent abuse

## Related Documentation

- [Transaction Processing API](./transaction-processing.md) - How rules integrate with processing
- [Categories API](./categories.md) - Category management for rule targets
- [Database Schema](../system/database-schema.md) - Database table structure

---

*Updated: September 1, 2025*
