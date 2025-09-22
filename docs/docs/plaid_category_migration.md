# Plaid Standard Personal Finance Categories Migration - Work Breakdown Structure

## Overview

This migration moves the categorization framework from custom categories and separate regex rules to Plaid's Standard Personal Finance Categories with an integrated merchant-regex mapping system. The new approach consolidates merchant identification and category assignment into a single, streamlined process.

## Pre-Migration Analysis

### Current State

- Custom categories system with separate `global_regex_rules` table for merchant matching
- Existing merchants table without Plaid category mappings
- Transaction processing using multiple lookup tables including global regex patterns
- Frontend using custom category icons and names
- User-specific rules in `user_rules` table (UNCHANGED - handles user transaction rules)

### Target State

- Plaid Standard Personal Finance Categories (hierarchical) - **FILES READY**
- New merchants table with integrated regex matching - **FILES READY**
- Consolidated merchant-category-regex mapping (replaces global_regex_rules)
- Simplified transaction processing pipeline using merchants.regex_match
- Consistent Plaid-based category naming and icons
- User rules system remains completely unchanged

### Migration Files Prepared

- `categories.csv` - Complete Plaid category hierarchy with proper icon mappings (40+ categories)
- `merchants.csv` - 45+ merchants with category_id mappings and regex_match patterns

---

## Phase 1: Database Schema Migration ✅ COMPLETE

### 1.1 Verify Migration Files Ready ✅ COMPLETE

**Priority: Critical** | **Time: 10 minutes**

- [x] **1.1.1** Verify categories CSV structure

  - [ ] Confirm `categories.csv` has headers: `category_id,user_id,category,parent_category,parent_id,icon_kebab,plain_name,created_at,lucide_icon,description`
  - [ ] Verify data contains both parent and child categories
  - [ ] Check that icons are mapped in both `lucide_icon` and `icon_kebab` fields

- [ ] **1.1.2** Verify merchants CSV structure
  - [ ] Confirm `merchants.csv` has headers: `merchant_id,merchant_name,created_at,category_id,logo_url,regex_match`
  - [ ] Verify all merchants have valid `category_id` references
  - [ ] Check that `regex_match` patterns are present for all merchants

### 1.2 Analyze and Migrate Global Regex Rules

**Priority: Critical** | **Time: 1.5 hours**

- [ ] **1.2.1** Export and analyze existing global_regex_rules table

  ```sql
  -- Export current global regex rules
  COPY (SELECT * FROM global_regex_rules) TO '/backup/global_regex_rules_backup.csv' WITH CSV HEADER; -- DONE

  -- Analyze patterns not yet in new merchants table
  SELECT pattern, merchant_id, category_id, confidence
  FROM global_regex_rules
  ORDER BY confidence DESC;
  ```

### 1.2 Replace Categories Table with Plaid Categories

**Priority: Critical** | **Time: 45 minutes**

- [ ] **1.2.1** Drop existing categories table (after backup)

  ```sql
  -- Check for dependencies first (PostgreSQL syntax)
  SELECT DISTINCT
    kcu.table_name,
    kcu.column_name,
    kcu.constraint_name,
    ccu.table_name AS foreign_table_name
  FROM information_schema.key_column_usage kcu
  JOIN information_schema.table_constraints tc
    ON kcu.constraint_name = tc.constraint_name
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'categories';

  -- Drop with CASCADE (be very careful!)
  DROP TABLE IF EXISTS categories CASCADE;
  ```

- [ ] **1.2.2** Create new categories table structure

  ```sql
  CREATE TABLE categories (
    category_id UUID PRIMARY KEY, -- Use CSV structure, not existing 'id'
    user_id UUID, -- NULL for system categories
    category TEXT NOT NULL, -- Plaid category constant (e.g. FOOD_AND_DRINK)
    parent_category TEXT, -- Parent Plaid category constant
    parent_id UUID REFERENCES categories(category_id), -- Reference new PK
    icon_kebab TEXT, -- kebab-case icon name
    name TEXT NOT NULL, -- Display name for compatibility
    plain_name TEXT NOT NULL, -- CSV display name (e.g. "Food & Drink")
    created_at TIMESTAMPTZ DEFAULT NOW(),
    icon TEXT, -- Icon for compatibility
    lucide_icon TEXT, -- PascalCase Lucide icon name from CSV
    description TEXT
  );

  -- Add indexes
  CREATE INDEX idx_categories_parent_id ON categories(parent_id);
  CREATE INDEX idx_categories_category ON categories(category);
  CREATE INDEX idx_categories_user_id ON categories(user_id);
  ```

- [ ] **1.2.3** Import prepared Plaid categories

  **Using Supabase CSV Uploader:**

  - [ ] Go to Supabase Dashboard → Database → categories table
  - [ ] Click "Insert" → "Import data from CSV"
  - [ ] Upload your `categories.csv` file
  - [ ] Map CSV columns to table columns:
    - `category_id` → `category_id`
    - `user_id` → `user_id`
    - `category` → `category`
    - `parent_category` → `parent_category`
    - `parent_id` → `parent_id`
    - `icon_kebab` → `icon_kebab`
    - `plain_name` → `plain_name`
    - `created_at` → `created_at`
    - `lucide_icon` → `lucide_icon`
    - `description` → `description`
  - [ ] Complete the import

  ```sql
  -- After import, update compatibility columns
  UPDATE categories SET name = plain_name, icon = lucide_icon;
  ```

- [ ] **1.2.4** Verify Plaid categories import

  ```sql
  SELECT COUNT(*) as total_categories,
         COUNT(DISTINCT parent_category) as parent_categories,
         COUNT(*) FILTER (WHERE parent_id IS NULL) as top_level_categories
  FROM categories;
  -- Should show 80+ categories with proper hierarchy
  ```

- [ ] **1.2.4** Verify category import
  ```sql
  SELECT COUNT(*) as total_categories,
         COUNT(DISTINCT parent_category) as parent_categories,
         COUNT(*) FILTER (WHERE parent_id IS NULL) as top_level_categories
  FROM categories;
  ```

### 1.3 Replace Merchants Table with Plaid-Integrated Version

**Priority: Critical** | **Time: 45 minutes**

- [ ] **1.3.1** Drop existing merchants table (after backing up)

  ```sql
  -- Check dependencies first (PostgreSQL syntax)
  SELECT DISTINCT
    kcu.table_name,
    kcu.column_name,
    kcu.constraint_name,
    ccu.table_name AS foreign_table_name
  FROM information_schema.key_column_usage kcu
  JOIN information_schema.table_constraints tc
    ON kcu.constraint_name = tc.constraint_name
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'merchants';

  DROP TABLE IF EXISTS merchants CASCADE;
  ```

- [ ] **1.3.2** Create new merchants table structure

  ```sql
  CREATE TABLE merchants (
    merchant_id UUID PRIMARY KEY, -- Use CSV structure, not existing 'id'
    name TEXT NOT NULL, -- Keep name column for compatibility
    created_at TIMESTAMPTZ DEFAULT NOW(),
    default_category_id UUID REFERENCES categories(category_id), -- Reference new category PK
    logo_url TEXT, -- Keep existing column
    aliases TEXT, -- Keep existing column
    regex_match TEXT NOT NULL, -- NEW: consolidated from global_regex_rules

    -- Additional useful columns
    confidence_score NUMERIC(3,2) DEFAULT 1.0,
    is_active BOOLEAN DEFAULT TRUE,
    last_matched_at TIMESTAMPTZ,
    match_count INTEGER DEFAULT 0
  );

  -- Critical indexes for performance
  CREATE INDEX idx_merchants_default_category_id ON merchants(default_category_id);
  CREATE INDEX idx_merchants_name ON merchants(name);
  CREATE INDEX idx_merchants_active ON merchants(is_active);
  CREATE INDEX idx_merchants_regex_match ON merchants(regex_match);
  ```

- [ ] **1.3.3** Import prepared merchants data

  **Method 1: Direct CSV Upload (if column names match exactly)**

  - [ ] Use Supabase UI CSV uploader on merchants table
  - [ ] Map CSV columns to table columns:
    - `merchant_id` → `merchant_id`
    - `merchant_name` → `name`
    - `created_at` → `created_at`
    - `category_id` → `default_category_id`
    - `logo_url` → `logo_url`
    - `regex_match` → `regex_match`

  **Method 2: Using Import Table (if column mapping needed)**

  ```sql
  -- Create import table with CSV column names
  CREATE TABLE merchants_import (
    merchant_id UUID,
    merchant_name TEXT,
    created_at TIMESTAMPTZ,
    category_id UUID,
    logo_url TEXT,
    regex_match TEXT
  );

  -- Use Supabase CSV uploader to import into merchants_import table
  -- Then transfer data with column mapping:
  INSERT INTO merchants (merchant_id, name, created_at, default_category_id, logo_url, regex_match)
  SELECT merchant_id, merchant_name, created_at, category_id, logo_url, regex_match
  FROM merchants_import;

  -- Clean up
  DROP TABLE merchants_import;
  ```

- [ ] **1.3.4** Verify merchants import and relationships

  ```sql
  -- Should show 271+ merchants with proper category relationships
  SELECT COUNT(*) as total_merchants,
         COUNT(DISTINCT default_category_id) as unique_categories,
         COUNT(*) FILTER (WHERE regex_match IS NOT NULL) as merchants_with_regex
  FROM merchants;

  -- Verify all default_category_ids exist (should return 0)
  SELECT COUNT(*) as orphaned_merchants
  FROM merchants m
  LEFT JOIN categories c ON m.default_category_id = c.category_id
  WHERE c.category_id IS NULL;
  ```

### 1.4 Update Transactions Table

**Priority: Critical** | **Time: 1 hour**

- [ ] **1.4.1** Add new foreign key constraints to transactions

  ```sql
  -- Check current transactions table structure (Already done - see schema above)
  -- Transactions table already has:
  --   - merchant_id (UUID, nullable) ✅
  --   - primary_category_id (UUID, nullable) ✅
  -- Missing: category_id column for general categorization

  -- Add category_id column if needed for general categorization
  DO $$
  BEGIN
    -- Check if category_id column exists (separate from primary_category_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'transactions' AND column_name = 'category_id') THEN
      ALTER TABLE transactions ADD COLUMN category_id UUID;
    END IF;
  END $$;

  -- Add/Update foreign key constraints with new table structure
  -- merchant_id constraint (may need to be recreated)
  ALTER TABLE transactions
    DROP CONSTRAINT IF EXISTS fk_transactions_merchant_id,
    ADD CONSTRAINT fk_transactions_merchant_id
    FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE SET NULL;

  -- category_id constraint (for general categorization)
  ALTER TABLE transactions
    DROP CONSTRAINT IF EXISTS fk_transactions_category_id,
    ADD CONSTRAINT fk_transactions_category_id
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL;

  -- primary_category_id constraint (for main/primary category)
  ALTER TABLE transactions
    DROP CONSTRAINT IF EXISTS fk_transactions_primary_category_id,
    ADD CONSTRAINT fk_transactions_primary_category_id
    FOREIGN KEY (primary_category_id) REFERENCES categories(category_id) ON DELETE SET NULL;
  ```

- [ ] **1.4.2** Create indexes for better performance
  ```sql
  CREATE INDEX IF NOT EXISTS idx_transactions_merchant_id ON transactions(merchant_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_original_description ON transactions(original_description);
  ```

### 1.4 Clean Up Legacy Tables

**Priority: Medium** | **Time: 15 minutes**

- [ ] **1.4.1** Drop global_regex_rules table (now consolidated into merchants)

  ```sql
  -- This table is replaced by regex_match column in merchants table
  DROP TABLE IF EXISTS global_regex_rules CASCADE;
  ```

- [ ] **1.4.2** Verify no other legacy regex/rules tables exist
  ```sql
  -- Check for any other legacy rule tables (excluding user_rules which stays)
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND (table_name LIKE '%global%rule%' OR table_name LIKE '%regex%')
  AND table_name != 'user_rules';
  ```

**Note:** The `user_rules` table is intentionally left unchanged as it handles user-specific transaction rules, which are separate from the merchant categorization system.

---

## Phase 2: Backend Code Refactoring (Estimated: 5-6 hours)

### 2.1 Update Transaction Processing Logic

**Priority: Critical** | **Time: 3 hours**

- [ ] **2.1.1** Update merchant matching in `/python/core/matching.py`

  - [ ] Replace old regex lookup with new merchants table regex_match column
  - [ ] Implement regex matching against transaction descriptions
  - [ ] Return both merchant_id and category_id for transactions
  - [ ] Add logging for unmatched transactions

- [ ] **2.1.2** Modify transaction processor in `/python/core/transaction_processor.py`

  - [ ] Update to use new merchant/category assignment logic
  - [ ] Remove references to old category assignment methods
  - [ ] Ensure merchant_id and category_id are saved to transactions table

- [ ] **2.1.3** Test merchant matching logic

  ```python
  # Create test script to verify regex matching
  import re
  from supabase_client.client import get_supabase_client

  def test_merchant_matching():
      supabase = get_supabase_client()
      merchants = supabase.table('merchants').select('*').execute()

      test_descriptions = [
          "STARBUCKS STORE #12345",
          "AMAZON.COM AMZN.COM/BILL",
          "TARGET T-1234 GROCERY"
      ]

      for desc in test_descriptions:
          matched = False
          for merchant in merchants.data:
              if re.search(merchant['regex_match'], desc, re.IGNORECASE):
                  print(f"'{desc}' -> {merchant['name']} ({merchant['plaid_category']})")
                  matched = True
                  break
          if not matched:
              print(f"'{desc}' -> NO MATCH")
  ```

### 2.2 Update Backend API Endpoints for Plaid Categories

**Priority: High** | **Time: 3 hours**

- [ ] **2.2.1** Update `/python/app/routers/categories.py`

  - [ ] Modify endpoints to return Plaid category structure
  - [ ] Update response models to include `parent_category`, `parent_id`, `lucide_icon`, `description`
  - [ ] Add hierarchical category retrieval methods for tree structure
  - [ ] Ensure `/categories/tree` endpoint returns proper parent-child relationships

- [ ] **2.2.2** Update `/python/app/routers/merchants.py`

  - [ ] Modify merchant search to include `plaid_category` and `category_id` information
  - [ ] Update merchant creation/editing to require category_id (foreign key to new categories)
  - [ ] Add regex pattern validation for merchant creation
  - [ ] Ensure responses include associated Plaid category details

- [ ] **2.2.3** Update `/python/app/routers/transactions.py`

  - [ ] Ensure transaction creation uses new merchant/category logic
  - [ ] Update transaction editing to support new schema
  - [ ] Update responses to include Plaid category names and hierarchy
  - [ ] Add bulk re-categorization endpoint

- [ ] **2.2.4** Test all API endpoints with new schema

  ```bash
  # Test categories endpoint with hierarchy
  curl http://localhost:8000/categories/tree

  # Test merchants endpoint with category info
  curl http://localhost:8000/merchants/search?q=starbucks

  # Test transaction creation with new categorization
  curl -X POST http://localhost:8000/transactions -d '{"description": "STARBUCKS #123", "amount": -5.99}'
  ```

### 2.3 Update Data Processing Scripts

**Priority: Medium** | **Time: 1.5 hours**

- [ ] **2.3.1** Update CSV processor in `/python/app/routers/csv_processor.py`

  - [ ] Modify to use new merchant matching logic
  - [ ] Ensure proper category assignment during bulk imports
  - [ ] Add validation for merchant/category relationships

- [ ] **2.3.2** Update transaction upload in `/python/app/routers/transaction_upload.py`
  - [ ] Use new categorization system
  - [ ] Add merchant matching during upload process
  - [ ] Handle unmatched transactions appropriately

### 2.4 Remove References to Global Regex Rules

**Priority: Low** | **Time: 30 minutes**

- [ ] **2.4.1** Update transaction processing to use merchants.regex_match

  - [ ] Remove any code that queries global_regex_rules table
  - [ ] Ensure merchant matching uses merchants.regex_match column exclusively
  - [ ] Test that regex matching performance is acceptable

- [ ] **2.4.2** Clean up unused imports and references
  - [ ] Remove imports related to global_regex_rules
  - [ ] Clean up any unused utility functions for old regex system
  - [ ] Update documentation/comments that reference old system

**Note:** The user_rules system remains completely unchanged and handles user-specific transaction rules independently.

### 2.5 Critical: User Rules System (NO CHANGES REQUIRED)

**Priority: None** | **Time: 0 hours**

**IMPORTANT:** The user rules system is completely separate from merchant categorization and requires NO changes:

- [ ] **2.5.1** Verify user rules still reference category IDs correctly

  - [ ] User rules table uses `category_id` to reference categories
  - [ ] After new categories are imported, existing user rule `category_id` values should be updated to reference new Plaid category IDs
  - [ ] Test that user rules continue to work with new category structure

- [ ] **2.5.2** Update user rule category references (ONLY IF NEEDED)
  - [ ] Create a mapping between old category IDs and new Plaid category IDs
  - [ ] Update existing user rules to reference new category IDs if categories are being replaced
  - [ ] Ensure user rule evaluation continues to work unchanged

**Key Points:**

- User rules logic in `/python/app/routers/user_rules.py` stays the same
- User rule components in `/src/app/private/rules/` stay the same
- Enhanced user rules with complex conditions remain unchanged
- Only category ID references may need updating to point to new Plaid categories

---

## Phase 3: Frontend Refactoring (Estimated: 6-8 hours)

### 3.1 Update Category Components and Icon System

**Priority: High** | **Time: 3 hours**

- [ ] **3.1.1** Update CategoryIcon component for Plaid icons

  - [ ] Modify `/src/components/private/transactions/enhanced_table/CategoryIcon.tsx`
  - [ ] Update component to use `lucide_icon` field from categories (already in PascalCase)
  - [ ] Add fallback to `icon_kebab` if `lucide_icon` not available
  - [ ] Test icon rendering with new Plaid categories

- [ ] **3.1.2** Update category picker components for new schema

  - [ ] Update `/src/components/private/categories/CategorySingleSelectPopover.tsx` to use `plain_name` for display
  - [ ] Update `/src/components/private/categories/CategoryTreePicker.tsx` to use `category_id` as primary key
  - [ ] Ensure proper handling of `parent_id` relationships
  - [ ] Test hierarchical category display

- [ ] **3.1.3** Update category API integration

  - [ ] Modify `/src/app/api/categories/tree/route.ts` to handle new Plaid structure
  - [ ] Update `/src/app/api/categories/with-icons/route.ts` for new icon format
  - [ ] Ensure proper forwarding to Python backend
  - [ ] Update query parameters and response handling

- [ ] **3.1.4** Update category hooks and TypeScript interfaces
  - [ ] Modify `/src/hooks/useCategories.ts` interface to match Plaid schema
  - [ ] Update Category interface to include `lucide_icon`, `parent_category`, `parent_id`
  - [ ] Update all TypeScript interfaces in category components
  - [ ] Ensure proper icon mapping and fallbacks

### 3.2 Update Merchant Components

**Priority: High** | **Time: 1.5 hours**

- [ ] **3.2.1** Update merchant picker in transaction editing

  - [ ] Modify to show associated Plaid category
  - [ ] Update merchant search to include category context
  - [ ] Ensure merchant-category relationship is visible

- [ ] **3.2.2** Update merchant management interfaces
  - [ ] Add category assignment to merchant creation
  - [ ] Show regex patterns in merchant editing (admin only)
  - [ ] Display merchant statistics with category breakdown

### 3.3 Update Transaction Display

**Priority: Medium** | **Time: 1.5 hours**

- [ ] **3.3.1** Update transaction table columns

  - [ ] Ensure category column shows Plaid category names
  - [ ] Update merchant column to link to merchant details
  - [ ] Add category icon display

- [ ] **3.3.2** Update transaction editing drawer
  - [ ] Use new category and merchant pickers
  - [ ] Show category hierarchy in editing interface
  - [ ] Display merchant regex match information (if applicable)

### 3.4 Update TypeScript Interfaces and Data Layer

**Priority: High** | **Time: 2 hours**

- [ ] **3.4.1** Update category TypeScript interfaces

  - [ ] Modify category interfaces to match CSV schema:
    - `category_id` (UUID, primary key)
    - `plain_name` (display name)
    - `category` (Plaid constant)
    - `parent_category`, `parent_id`
    - `lucide_icon`, `icon_kebab`
    - `description`
  - [ ] Update all components using Category interface
  - [ ] Update mock data in `/src/data/transaction-table.ts`

- [ ] **3.4.2** Update merchant interfaces

  - [ ] Update merchant interface to match CSV schema:
    - `merchant_id` (UUID, primary key)
    - `merchant_name` (display name)
    - `category_id` (foreign key)
    - `regex_match`
    - `logo_url`
  - [ ] Update transaction interface for new relationships

- [ ] **3.4.3** Update React hooks for new data structure

  - [ ] Modify `/src/hooks/useCategories.ts` for new schema
  - [ ] Update `/src/hooks/useMerchants.ts` for new merchant structure
  - [ ] Test data fetching with new API structure

- [ ] **3.4.4** Update mock/demo data

  - [ ] Update `/src/data/transaction-table.ts` with Plaid category examples
  - [ ] Update any hardcoded category references in demo components
  - [ ] Ensure `/src/app/private/category-demo/page.tsx` works with new schema

- [ ] **3.4.2** Update React hooks
  - [ ] Modify `/src/hooks/useMerchants.ts` for new schema
  - [ ] Update category-related hooks
  - [ ] Test data fetching with new API structure

---

## Phase 4: Data Migration and Testing (Estimated: 3-4 hours)

### 4.1 Migrate Existing Transaction Data

**Priority: Critical** | **Time: 2 hours**

Since you mentioned existing transactions are removed, this phase is simplified:

- [ ] **4.1.1** Verify clean slate

  ```sql
  SELECT COUNT(*) FROM transactions;  -- Should be 0 or minimal
  ```

- [ ] **4.1.2** Test transaction processing with new schema
  - [ ] Upload a small test CSV file
  - [ ] Verify merchants are matched correctly
  - [ ] Confirm categories are assigned properly
  - [ ] Check that regex matching works as expected

### 4.2 Comprehensive Testing

**Priority: Critical** | **Time: 1.5 hours**

- [ ] **4.2.1** Database integrity tests

  ```sql
  -- Test foreign key constraints
  SELECT COUNT(*) FROM transactions t
  LEFT JOIN merchants m ON t.merchant_id = m.merchant_id
  WHERE t.merchant_id IS NOT NULL AND m.merchant_id IS NULL;

  -- Test category relationships
  SELECT COUNT(*) FROM merchants m
  LEFT JOIN categories c ON m.default_category_id = c.category_id
  WHERE c.category_id IS NULL;

  -- Test regex patterns
  SELECT merchant_id, name, regex_match
  FROM merchants
  WHERE regex_match IS NULL OR regex_match = '';
  ```

- [ ] **4.2.2** Backend API testing

  ```bash
  # Test all major endpoints
  pytest python/tests/ -v

  # Test specific transaction processing
  python -m pytest python/tests/test_transaction_processing.py
  ```

- [ ] **4.2.3** Frontend functionality testing
  - [ ] Test transaction upload and categorization
  - [ ] Verify category picker functionality
  - [ ] Test merchant search and selection
  - [ ] Confirm transaction editing works correctly

### 4.3 Performance Testing

**Priority: Medium** | **Time: 30 minutes**

- [ ] **4.3.1** Test merchant matching performance

  ```python
  # Performance test for regex matching
  import time
  import re

  def test_matching_performance():
      # Test with 1000+ transaction descriptions
      start_time = time.time()
      # Run merchant matching logic
      end_time = time.time()
      print(f"Processing time: {end_time - start_time:.2f} seconds")
  ```

- [ ] **4.3.2** Database query performance
  ```sql
  EXPLAIN ANALYZE
  SELECT t.*, m.name as merchant_name, c.plain_name as category_name
  FROM transactions t
  LEFT JOIN merchants m ON t.merchant_id = m.id
  LEFT JOIN categories c ON t.category_id = c.id
  WHERE t.user_id = 'user-uuid'
  ORDER BY t.date DESC;
  ```

---

## Phase 5: Documentation and Cleanup (Estimated: 2-3 hours)

### 5.1 Update Documentation

**Priority: Medium** | **Time: 1.5 hours**

- [ ] **5.1.1** Update API documentation

  - [ ] Document new category and merchant endpoints
  - [ ] Update transaction processing documentation
  - [ ] Add examples for new data structures

- [ ] **5.1.2** Update developer documentation

  - [ ] Document new database schema
  - [ ] Update transaction processing flow diagrams
  - [ ] Add merchant regex pattern guidelines

- [ ] **5.1.3** Create user migration guide
  - [ ] Document changes visible to users
  - [ ] Explain new category structure
  - [ ] Provide troubleshooting guide

### 5.2 Final Cleanup

**Priority: Low** | **Time: 1 hour**

- [ ] **5.2.1** Remove unused code

  - [ ] Clean up old category references
  - [ ] Remove deprecated API endpoints
  - [ ] Clean up unused imports and functions

- [ ] **5.2.2** Code quality improvements

  - [ ] Run linting and fix issues
  - [ ] Add missing type annotations
  - [ ] Update error handling for new schema

- [ ] **5.2.3** Final verification
  - [ ] Run full test suite
  - [ ] Verify no broken references to old schema
  - [ ] Confirm all features work end-to-end

---

## Critical Success Criteria

### Database Migration

- [ ] All Plaid categories imported successfully (80+ categories)
- [ ] All merchants have valid category_id references
- [ ] All regex patterns are valid and tested
- [ ] Foreign key constraints are properly established

### Backend Functionality

- [ ] Transaction processing correctly matches merchants via regex
- [ ] Categories are assigned through merchant relationships
- [ ] All API endpoints return data in new format
- [ ] Global regex rules are properly migrated to merchants table (if applicable)

### Frontend Integration

- [ ] Category picker displays Plaid hierarchy correctly
- [ ] Merchant selection shows associated categories
- [ ] Transaction editing works with new schema
- [ ] Icons and naming match Plaid standards

### Performance

- [ ] Merchant matching completes within acceptable time limits
- [ ] Database queries are optimized with proper indexes
- [ ] No significant performance degradation from migration

---

## Risk Mitigation

### High-Risk Items

1. **Data Loss**: Always backup before making schema changes
2. **Regex Failures**: Test all regex patterns before deployment
3. **Foreign Key Violations**: Ensure referential integrity during migration
4. **Performance Degradation**: Monitor query performance after migration

### Rollback Plan

1. Keep complete database backups before starting
2. Document all schema changes for reversal
3. Maintain old API endpoints temporarily if needed
4. Test rollback procedure in staging environment

---

## Resources Required

### Development Environment

- [ ] Staging database with production data copy
- [ ] Local development environment with new schema
- [ ] API testing tools (Postman, curl, pytest)
- [ ] Database administration tools

### Skills/Knowledge

- [ ] SQL DDL and data migration expertise
- [ ] Python/FastAPI backend development
- [ ] React/TypeScript frontend development
- [ ] Regex pattern writing and testing
- [ ] Database performance optimization

### Time Estimates

- **Phase 1 (Database)**: 1.5-2 hours (simplified due to proper CSV structure and completed backups)
- **Phase 2 (Backend)**: 4-5 hours (API updates and regex system changes)
- **Phase 3 (Frontend)**: 5-6 hours (component updates, simpler icon handling)
- **Phase 4 (Testing)**: 2-3 hours (reduced due to cleaner data structure)
- **Phase 5 (Documentation)**: 1-2 hours
- **Total**: 13.5-18 hours over 2-3 days

**Key Simplifications:**

- Categories CSV already has proper icon mappings in both `lucide_icon` and `icon_kebab`
- Display names ready in `plain_name` field
- Primary keys match CSV structure (`category_id`, `merchant_id`)
- Backups already completed
- Icon mapping is straightforward since `lucide_icon` is already in PascalCase

---

This comprehensive migration plan will successfully transition your system to use Plaid's Standard Personal Finance Categories while consolidating merchant matching and categorization into a streamlined, maintainable system.
