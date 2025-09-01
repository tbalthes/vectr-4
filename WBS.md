# Vectr-4 Transaction Management System - Work Breakdown Structure

## Project Status Overview

### ✅ COMPLETED - Task 1.1: Categories Tree API & Frontend

- [x] **1.1.1** Categories Tree API Endpoint (FastAPI)
- [x] **1.1.2** React CategoryTreePicker Component
- [x] **1.1.3** Search and Filtering Functionality
- [x] **1.1.4** Transaction Drawer Integration
- [x] **1.1.5** Database Persistence Fix (Primary Category ID)

**Status**: Complete and tested with real Supabase data (57 categories, hierarchical structure)

---

## 🚧 IN PROGRESS - Core Transaction Enhancement Features

### Task 1.2: Advanced Merchant Picker Component

**Goal**: Search-enabled merchant selector that pulls from Supabase merchants table

- [x] **1.2.1** Enhanced Merchant API Endpoint

  - ✅ Created `/api/merchants/search` with search functionality
  - ✅ Added fuzzy search capabilities with ranking
  - ✅ Include merchant categories and metadata
  - ✅ Pagination support for large merchant lists

- [x] **1.2.2** MerchantPicker React Component

  - ✅ Search-enabled dropdown with typeahead
  - ✅ Real-time search as user types
  - ✅ Display merchant name, logo, and category context
  - ✅ "Create new merchant" inline option
  - ✅ Integration with existing transaction editing

- [x] **1.2.3** Transaction Drawer Integration
  - ✅ Replaced basic merchant input with MerchantPicker
  - ✅ Maintain existing transaction update flow
  - ✅ Handle new merchant creation workflow

**Status**: Complete - Advanced merchant search and selection working

### Task 1.3: Advanced Transaction Filtering System

**Goal**: Comprehensive filtering UI for transaction table with multiple criteria

- [ ] **1.3.1** Advanced Filter Components

  - Amount range filter (min/max with operators)
  - Date range picker component
  - Category filter (using CategoryTreePicker)
  - Merchant filter (using MerchantPicker)
  - Status filter (needs_review, manual_edit, etc.)
  - Multi-criteria combination logic

- [ ] **1.3.2** Filter State Management

  - URL-based filter persistence
  - Filter save/load functionality
  - Filter presets (e.g., "Last Month", "Needs Review")
  - Clear all filters functionality

- [ ] **1.3.3** Advanced Filter UI
  - Collapsible filter panel
  - Visual filter chips showing active filters
  - Filter count indicators
  - Advanced/simple toggle modes

### Task 1.4: Custom Rules Management System

**Goal**: UI for creating and managing user_rules that automatically categorize transactions

- [ ] **1.4.1** User Rules API Enhancement

  - Extend existing `/user-rules` endpoints
  - Add rule testing/preview functionality
  - Batch rule application to existing transactions
  - Rule priority and conflict resolution

- [ ] **1.4.2** Rule Builder UI Component

  - Visual rule builder with condition/action pattern
  - Field selection: `original_description`, `amount`, `merchant_name`
  - Operator selection: `contains`, `equals`, `regex`, `greater_than`, etc.
  - Category assignment using CategoryTreePicker
  - Rule priority and enable/disable controls

- [ ] **1.4.3** Rules Management Interface
  - Rules list page with search and filtering
  - Rule testing with preview of affected transactions
  - Bulk enable/disable rules
  - Rule import/export functionality
  - Rule performance metrics

### Task 1.5: Enhanced Date Range Filtering

**Goal**: Advanced date picker with presets and flexible date range selection

- [ ] **1.5.1** DateRangePicker Component

  - Calendar-based date selection
  - Quick preset buttons (Last 7/30/90 days, This Month, etc.)
  - Custom date range input
  - Relative date support ("Last N days")

- [ ] **1.5.2** Date Filter Integration
  - Integration with transaction filtering system
  - URL persistence of date ranges
  - Performance optimization for large date ranges

## 📋 Implementation Priority Order

### Phase 1: Core Enhancements (Immediate)

1. **Task 1.2**: Advanced Merchant Picker
2. **Task 1.3**: Advanced Transaction Filtering
3. **Task 1.5**: Enhanced Date Range Filtering

### Phase 2: Automation Features (Next)

4. **Task 1.4**: Custom Rules Management System

## 🏗️ Technical Architecture

### Database Schema Context

```sql
-- Key tables for implementation:
user_rules: user_id, match_field, match_operator, match_value, category_id, rule_action, priority, enabled
transactions: id, original_description, amount, date, primary_category_id, merchant_id, needs_review
merchants: id, name, logo_url, categories
categories: id, name, icon, parent_id (hierarchical)
transaction_categories: transaction_id, category_id (join table)
```

### Frontend Component Hierarchy

```
TransactionTable
├── AdvancedFilters
│   ├── DateRangePicker
│   ├── CategoryTreePicker (✅ completed)
│   ├── MerchantPicker
│   └── AmountRangeFilter
├── TransactionDetailsDrawer
│   ├── CategoryTreePicker (✅ completed)
│   └── MerchantPicker
└── RulesManagement
    ├── RuleBuilder
    ├── RulesList
    └── RulePreview
```

### API Endpoints Required

```
GET  /api/merchants/search?q=query
POST /api/merchants (create new)
GET  /api/user-rules
POST /api/user-rules (create)
PUT  /api/user-rules/:id (update)
POST /api/user-rules/preview (test rule)
POST /api/user-rules/apply-retroactive
```

## 🎯 Success Criteria

- [ ] Users can search and select merchants with typeahead
- [ ] Advanced filtering works with multiple criteria combinations
- [ ] Date range picker provides intuitive date selection
- [ ] Users can create custom rules that automatically categorize transactions
- [ ] All components integrate seamlessly with existing transaction workflow
- [ ] Database operations maintain data integrity and performance

## 📝 Notes

- **Existing Infrastructure**: Category picker (Task 1.1) is complete and serves as template
- **Database Ready**: user_rules table exists with proper schema
- **API Foundation**: Basic endpoints exist, need enhancement for search/filtering
- **UI Consistency**: All new components should match existing design patterns
