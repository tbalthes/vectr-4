# PATCH /transactions/{id} Endpoint Implementation

## Overview

Implemented a comprehensive atomic transaction editing endpoint with full audit trail support and proper validation.

## Features Implemented

### 1. Database Schema (SQL)

- **`transaction_edits` audit table**: Stores complete before/after state for every transaction edit
- **Enhanced `transactions` table**: Added `manual_edit`, `edited_at`, `edited_by` columns
- **Performance indexes**: Optimized queries for needs_review, manual_edit filtering
- **RLS security**: Users can only see their own audit records

### 2. Atomic RPC Function

- **`patch_transaction_complete`**: Single DB function handling all updates atomically
  - Updates transaction fields (merchant, description, review status)
  - Syncs category associations (replaces existing links)
  - Sets manual edit metadata (`manual_edit=true`, `edited_at`, `edited_by`)
  - Writes detailed audit trail with before/after JSONB diff
  - Prevents merchant creation without explicit merchant_id

### 3. FastAPI Endpoint

- **PATCH `/transactions/{id}`**: Comprehensive validation and error handling
  - UUID validation for all ID fields
  - Merchant creation prevention (must select existing merchant)
  - Authenticated user ID extraction with fallback to transaction owner
  - Structured response with audit metadata
  - Proper error handling with meaningful messages

### 4. Test Coverage

- **13 unit tests** for endpoint behavior covering:
  - Successful patch operations (full and minimal)
  - Validation errors (invalid UUIDs, merchant creation attempts)
  - Error handling (transaction not found, RPC failures)
  - Audit note inclusion and category management
  - Authentication and user ID handling

## API Usage

### Request

```http
PATCH /transactions/{transaction_id}
Content-Type: application/json

{
  "merchant_id": "uuid-optional",
  "merchant_name": "string-optional", // Only if merchant_id provided
  "category_ids": ["uuid1", "uuid2"], // Replaces existing categories
  "clean_description": "string-optional",
  "needs_review": false,
  "edit_note": "User note about this edit"
}
```

### Response

```json
{
  "success": true,
  "transaction_id": "uuid",
  "audit_id": "uuid",
  "before": {
    "merchant_id": null,
    "category_ids": [],
    "clean_description": "old value",
    "needs_review": true,
    "manual_edit": false
  },
  "after": {
    "merchant_id": "new-uuid",
    "category_ids": ["cat1-uuid"],
    "clean_description": "new value",
    "needs_review": false,
    "manual_edit": true
  },
  "updated_at": "2025-01-15T10:30:00Z"
}
```

## Database Changes

### New Tables

```sql
-- Audit trail table
CREATE TABLE transaction_edits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    user_id UUID NOT NULL REFERENCES profiles(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changes JSONB NOT NULL, -- {"before": {...}, "after": {...}}
    note TEXT, -- User note about the edit
    edit_type TEXT DEFAULT 'manual' -- manual, rule_override, bulk_update
);

-- Enhanced transactions table
ALTER TABLE transactions ADD COLUMN
    manual_edit BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    edited_by UUID REFERENCES profiles(id);
```

### Performance Indexes

- `transaction_edits(transaction_id, user_id, changed_at)`
- `transactions(needs_review, user_id)` for review dashboard
- `transactions(manual_edit, user_id)` for manual edit filtering
- `transactions(edited_at)` for edit history queries

## Security

- **RLS policies**: Users can only edit their own transactions and see their own audit records
- **Input validation**: All UUIDs validated, merchant creation prevented
- **Audit integrity**: Every edit writes complete before/after state with user ID
- **Transaction safety**: All changes wrapped in database transaction

## Files Created/Modified

### SQL Files

- `sql/add_transaction_edits_audit.sql` - Schema migration
- `sql/patch_transaction_complete.sql` - Atomic RPC function
- `sql/install_patch_endpoint_complete.sql` - Complete installer with smoke tests

### Python Files

- `app/routers/transactions.py` - Enhanced PATCH endpoint with validation
- `tests/test_patch_transaction.py` - Comprehensive unit tests (13 tests)
- `tests/test_rpc_user_id.py` - Updated existing test for new RPC name

## Installation

1. Run `sql/install_patch_endpoint_complete.sql` in Supabase SQL editor
2. Deploy updated Python backend
3. Test endpoint with sample transaction edits

## Next Steps

- ✅ Rule ordering bug fixed and tested
- ✅ PATCH endpoint with audit trail implemented and tested
- 🔄 Ready for: POST `/user_rules/preview` endpoint (task #3)
- 🔄 Ready for: GET `/categories/tree` endpoint (task #4)
- 🔄 Ready for: Retroactive rules application job (task #5)
