# Migration to Merchant-Centric Data Model - Implementation Guide

## 🎯 **Objective**
Eliminate `clean_description` and `original_description` dependency in favor of proper merchant relationships using `merchant_name` + `merchant_id`. This will make error debugging much clearer and align with Plaid's data structure.

## 📋 **Migration Checklist**

### ✅ **Database Changes** 
- [x] **Primary Migration**: `020_standardize_schema_naming.sql` - Already exists
- [x] **Merchant-Centric Migration**: `021_plaid_centric_refactor.sql` - Created
- [ ] **Execute migrations** in production
- [ ] **Validate data integrity** post-migration

### 🔄 **Backend Code Changes**

#### **Python Processors**
- [x] **New Processor**: `merchant_centric_processor.py` - Created
- [ ] **Update Plaid Sync**: Modify `plaid_transaction_processor.py` to use new approach
- [ ] **Update CSV Import**: Modify CSV processors to create proper merchant relationships
- [ ] **Update User Rules**: Ensure user rules work with merchant-centric model

#### **API Routes**
- [x] **New Transactions API**: `route-merchant-centric.ts` - Created 
- [ ] **Replace existing routes** with merchant-centric versions
- [ ] **Update merchant endpoints** to handle new relationships
- [ ] **Test all API endpoints** with new data model

### 🎨 **Frontend Changes**

#### **TypeScript Types**
- [ ] **Update transaction types** to reflect merchant-centric model
- [ ] **Add merchant relationship types**
- [ ] **Remove clean_description dependencies**

#### **Components**
- [ ] **Update transaction display components** to use `merchantName` from joined data
- [ ] **Update search/filter logic** to use merchant table fields
- [ ] **Update transaction forms** for manual entry

### 📚 **Documentation Updates**
- [ ] **API documentation** - Update field descriptions
- [ ] **Database schema documentation** - Reflect new relationships
- [ ] **User guides** - Update transaction entry workflows

## 🛠 **Implementation Steps**

### **Phase 1: Database Migration**
```sql
-- Execute the standardization migration
\i sql/020_standardize_schema_naming.sql

-- Execute the merchant-centric migration  
\i sql/021_plaid_centric_refactor.sql

-- Validate migration
SELECT 
    COUNT(*) as total_transactions,
    COUNT(merchant_id) as with_merchant_id,
    COUNT(merchant_name) as with_merchant_name
FROM transactions;
```

### **Phase 2: Backend Implementation**

1. **Replace Plaid Processing Logic**:
```python
# Old approach (using clean_description)
def process_plaid_transaction(transaction_data):
    clean_description = parse_merchant_name(transaction_data['name'])
    return {'clean_description': clean_description}

# New approach (using merchant relationships)
def process_plaid_transaction(transaction_data):
    merchant_data = extract_counterparties(transaction_data)
    merchant_result = find_or_create_merchant(merchant_data)
    return {
        'merchant_id': merchant_result['merchant_id'],
        'merchant_name': merchant_result['merchant_name']
    }
```

2. **Update API Routes**:
```typescript
// Old query
SELECT transactions.*, transactions.clean_description
FROM transactions

// New query  
SELECT transactions.*, merchants.merchant_name, merchants.logo_url
FROM transactions
LEFT JOIN merchants ON transactions.merchant_id = merchants.merchant_id
```

### **Phase 3: Frontend Updates**

1. **Update Transaction Display**:
```tsx
// Old approach
<div>{transaction.clean_description}</div>

// New approach  
<div>{transaction.merchantName}</div>
```

2. **Update Search Logic**:
```typescript
// Old search
const filtered = transactions.filter(t => 
    t.clean_description?.toLowerCase().includes(search)
);

// New search
const filtered = transactions.filter(t => 
    t.merchantName?.toLowerCase().includes(search)
);
```

## 🔍 **Key Benefits After Migration**

### **1. Clearer Error Messages**
```
❌ Before: "ERROR: name cannot upsert"
✅ After:  "ERROR: merchant_name cannot upsert on merchants table"
```

### **2. Proper Data Relationships**
```sql
-- Clean joins instead of scattered fields
SELECT t.*, m.merchant_name, m.logo_url 
FROM transactions t
JOIN merchants m ON t.merchant_id = m.merchant_id
```

### **3. Plaid Data Fidelity**
```json
{
  "merchant_id": "uuid-generated",
  "merchant_name": "Sweetgreen",
  "logo_url": "https://plaid-merchant-logos.plaid.com/sweetgreen_986.png",
  "original_description": "SWEETGREEN DOWNTOWN SEATTLE WA"
}
```

### **4. Easier Merchant Management**
- Centralized merchant data in `merchants` table
- Automatic merchant creation from Plaid data
- User can manage merchant preferences globally
- Consistent merchant logos across transactions

## 🧪 **Testing Strategy**

### **Database Testing**
```sql
-- Test merchant creation
INSERT INTO merchants (merchant_name, user_id) VALUES ('Test Merchant', 'user-123');

-- Test transaction insertion with merchant
INSERT INTO transactions (merchant_id, merchant_name, original_description) 
VALUES (
    (SELECT merchant_id FROM merchants WHERE merchant_name = 'Test Merchant'),
    'Test Merchant',
    'RAW BANK DESCRIPTION'
);

-- Test the new views
SELECT * FROM transactions_display_view WHERE merchant_name = 'Test Merchant';
```

### **API Testing**
```bash
# Test transactions endpoint with new structure
curl "http://localhost:3000/api/transactions" \
  -H "Authorization: Bearer $TOKEN"

# Verify response includes merchant data
{
  "merchantName": "Sweetgreen",
  "merchantLogoUrl": "https://...",
  "originalDescription": "SWEETGREEN INC PAYROLL PPD ID"
}
```

### **Frontend Testing**
- [ ] Transaction list displays merchant names correctly
- [ ] Search works with merchant names
- [ ] Manual transaction entry creates merchants properly
- [ ] Merchant logos display correctly

## 🚨 **Migration Risks & Mitigation**

### **Risk 1: Data Loss**
- **Mitigation**: Run migrations in transaction with rollback plan
- **Backup**: Create full database backup before migration

### **Risk 2: Performance Impact**
- **Mitigation**: Added proper indexes in migration
- **Monitor**: Query performance post-migration

### **Risk 3: Frontend Breaking Changes**
- **Mitigation**: Create new API endpoints first, then migrate frontend gradually
- **Rollback**: Keep old endpoints available during transition

## 📈 **Success Metrics**

### **Technical Metrics**
- [ ] All transactions have `merchant_id` or `merchant_name`
- [ ] Error messages include specific field names
- [ ] Query performance maintains or improves
- [ ] No `clean_description` usage in new code

### **User Experience Metrics**
- [ ] Transaction display remains consistent
- [ ] Search functionality works as expected
- [ ] Manual transaction entry is intuitive
- [ ] Merchant logos display properly

## 🎉 **Completion Checklist**

- [ ] Database migrations executed successfully
- [ ] All Python processors updated to use merchant-centric approach
- [ ] API routes return merchant-joined data
- [ ] Frontend components use `merchantName` from API responses
- [ ] User rules system works with new merchant relationships
- [ ] Documentation updated to reflect new data model
- [ ] All tests pass with new data structure
- [ ] Performance benchmarks meet requirements
- [ ] Error messages are clear and actionable

---

## 🚀 **Ready to Deploy?**

Once all items are checked off, you'll have:
- ✅ Clear, debuggable error messages
- ✅ Proper merchant relationships
- ✅ Plaid data fidelity maintained  
- ✅ Scalable merchant management
- ✅ Consistent user experience

Your transactions will now properly reference merchant data instead of relying on parsed descriptions, making the system much more maintainable and user-friendly!