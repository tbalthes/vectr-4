# Safe Migration Strategy

## What We've Already Applied Safely ✅

### Backend Improvements
- ✅ Added `get_supabase_client()` getter function 
- ✅ Fixed CSV processor imports and error handling
- ✅ Improved transaction processing flow

### Frontend Improvements  
- ✅ Simplified LucideIcon component
- ✅ Improved TransactionRow styling
- ✅ Better visual consistency for tables

## What NOT to Apply (Breaking Changes) ❌

### Database Schema Mismatches
- ❌ Don't change `category_id` to `id` in API queries until database is updated
- ❌ Don't change `merchant_id` to `id` in API queries until database is updated  
- ❌ Don't remove `plain_name` field references until confirmed not needed
- ❌ Don't remove direct `category_id` fallback logic from transaction queries

### Specific Problematic Changes from 8720e1f
1. **Transaction API Route Changes**: The commit tried to standardize field names but database still uses original schema
2. **Category References**: Frontend expects `id` but database uses `category_id`
3. **Merchant References**: Frontend expects `id` but database uses `merchant_id`

## Safe Path Forward 🛣️

### Option 1: Database Schema Migration (Recommended)
1. **Create migration scripts** to add `id` columns as aliases to existing primary keys
2. **Update database views** to expose both old and new field names during transition
3. **Gradually update frontend** to use new field names after database migration
4. **Remove old field references** once migration is complete

### Option 2: Frontend Adaptation (Alternative)
1. **Keep database schema as-is** 
2. **Create API adapters** that transform database responses to expected frontend format
3. **Update frontend incrementally** while maintaining backward compatibility
4. **Use TypeScript interfaces** to ensure type safety during transition

### Option 3: Hybrid Approach (Most Practical)
1. **Start with API layer adapters** for immediate compatibility
2. **Plan database migration** for long-term consistency  
3. **Implement in phases** to minimize risk

## Next Steps 📋

1. **Test current working state** - Ensure transaction drawer and category/merchant lookups work
2. **Choose migration approach** based on project priorities  
3. **Create detailed migration plan** with rollback strategies
4. **Implement incrementally** with thorough testing at each step

## Files to Monitor 📁

### Critical API Routes
- `src/app/api/transactions/[id]/route.ts` - Transaction details API
- `src/app/api/categories/route.ts` - Category API  
- `src/app/api/merchants/route.ts` - Merchant API

### Database Schema Files
- All files in `sql/` directory
- Pay special attention to foreign key relationships

### Frontend Components
- Transaction components (drawer, table, etc.)
- Category and merchant pickers
- Rule builders

## Key Learnings 🎓

1. **Database schema changes require careful coordination** with frontend updates
2. **Field name standardization** must be done systematically across all layers
3. **Always test API compatibility** before deploying frontend changes
4. **Keep rollback strategies** for major architectural changes
5. **Use TypeScript** to catch field name mismatches early
