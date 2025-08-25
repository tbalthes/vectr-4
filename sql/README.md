# RPC Aggregate Time Series Implementation

## Overview

This directory contains the complete implementation of the `rpc_aggregate_time_series` PostgreSQL function designed to power the Analytics Aggregator API. The function provides zero-filled time series aggregation for financial transactions with comprehensive security, performance, and usability features.

## Files

- `001_create_aggregate_time_series_rpc.sql` - Main RPC function implementation
- `test_rpc_aggregate_time_series.sql` - Comprehensive test suite with fixtures
- `nextjs_invocation_example.ts` - Next.js API route implementation example
- `README.md` - This documentation file

## Installation

### 1. Prerequisites

- PostgreSQL 12+ with Supabase extensions
- Row Level Security (RLS) enabled on transactions table
- Authenticated user context for RLS operations

### 2. Apply Migration

```sql
-- Connect to your Supabase database
\i sql/001_create_aggregate_time_series_rpc.sql
```

### 3. Verify Installation

```sql
-- Check function creation
\df rpc_aggregate_time_series

-- Test with sample data
SELECT * FROM rpc_aggregate_time_series(
  '2024-08-18T00:00:00Z'::timestamptz,
  '2024-08-24T23:59:59Z'::timestamptz,
  NULL, -- Uses auth.uid() for RLS
  'day',
  ARRAY['income', 'spending']
);
```

## Function Signature

```sql
rpc_aggregate_time_series(
  start_date timestamptz,      -- Start of aggregation period
  end_date timestamptz,        -- End of aggregation period
  in_user_id uuid DEFAULT NULL, -- Optional user ID (NULL uses auth.uid())
  granularity text DEFAULT 'day', -- 'day', 'week', or 'month'
  metrics text[] DEFAULT ARRAY['income', 'spending'] -- Metrics to include
)
RETURNS TABLE(
  bucket_date date,
  income numeric,
  spending numeric,
  tx_count integer
)
```

## Parameters

| Parameter     | Type          | Required | Default                  | Description                              |
| ------------- | ------------- | -------- | ------------------------ | ---------------------------------------- |
| `start_date`  | `timestamptz` | Yes      | -                        | Start of aggregation period              |
| `end_date`    | `timestamptz` | Yes      | -                        | End of aggregation period                |
| `in_user_id`  | `uuid`        | No       | `NULL`                   | User ID (NULL uses `auth.uid()` for RLS) |
| `granularity` | `text`        | No       | `'day'`                  | Aggregation bucket size                  |
| `metrics`     | `text[]`      | No       | `['income', 'spending']` | Metrics to include                       |

### Parameter Details

#### granularity Options

- `'day'` - Daily buckets (recommended for dashboard charts)
- `'week'` - Weekly buckets (ISO week boundaries)
- `'month'` - Monthly buckets (calendar month boundaries)

#### metrics Options

- `'income'` - Sum of positive transaction amounts
- `'spending'` - Sum of negative transaction amounts (absolute values)
- Both can be specified together or individually

## Features

### ✅ Zero-Filled Time Series

- Generates complete date ranges using `generate_series`
- Includes empty buckets with zero values for consistent charting
- Handles arbitrary date ranges gracefully

### ✅ UTC Timezone Handling

- All calculations use UTC for consistency
- Explicit timezone conversion with `AT TIME ZONE 'UTC'`
- Deterministic bucket boundaries across environments

### ✅ Row Level Security (RLS)

- Automatic user isolation via `auth.uid()`
- Supports explicit `user_id` for service-role operations
- No data leakage between authenticated users

### ✅ Flexible Aggregation

- Configurable granularity (day/week/month)
- Selective metrics (income, spending, or both)
- Efficient filtering based on requested metrics

### ✅ Performance Optimized

- Composite indexes for common query patterns
- Metric-specific filtering to reduce computation
- Optimized for typical dashboard ranges (7-90 days)

## Usage Examples

### Basic Daily Aggregation (RLS)

```sql
SELECT * FROM rpc_aggregate_time_series(
  '2024-08-18T00:00:00Z'::timestamptz,
  '2024-08-24T23:59:59Z'::timestamptz
);
```

### Weekly Aggregation with Explicit User

```sql
SELECT * FROM rpc_aggregate_time_series(
  '2024-08-01T00:00:00Z'::timestamptz,
  '2024-08-31T23:59:59Z'::timestamptz,
  'user-uuid-here'::uuid,
  'week'
);
```

### Income Only Metric

```sql
SELECT * FROM rpc_aggregate_time_series(
  '2024-08-18T00:00:00Z'::timestamptz,
  '2024-08-24T23:59:59Z'::timestamptz,
  NULL,
  'day',
  ARRAY['income']
);
```

## Next.js Integration Example

```typescript
// src/app/api/analytics/aggregator/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();
  if (authError || !session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "30d";

  // Calculate date range based on parameters
  const { startDate, endDate } = calculateDateRange(range);

  // Call RPC function
  const { data, error } = await supabase.rpc("rpc_aggregate_time_series", {
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    granularity: "day",
    metrics: ["income", "spending"],
  });

  if (error) {
    return NextResponse.json({ error: "Database Error" }, { status: 500 });
  }

  // Transform response
  const response = {
    data: data.map((row) => ({
      bucket: row.bucket_date,
      income: Number(row.income || 0),
      spending: Number(row.spending || 0),
    })),
    metadata: {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      granularity: "day",
      totalRecords: data.reduce((sum, row) => sum + row.tx_count, 0),
      emptyBuckets: data.filter((row) => row.tx_count === 0).length,
    },
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=300" },
  });
}
```

## Database Indexes

For optimal performance, ensure these indexes exist:

```sql
-- Composite index for user + date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_date
ON transactions (user_id, date DESC);

-- Index for amount-based aggregations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_amount
ON transactions (user_id, amount);

-- Partial indexes for metric-specific queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_income
ON transactions (user_id, date, amount)
WHERE amount > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_spending
ON transactions (user_id, date, ABS(amount))
WHERE amount < 0;
```

## RLS Policies

Ensure these policies are in place:

```sql
-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- User data isolation
CREATE POLICY transactions_user_isolation ON transactions
FOR ALL USING (auth.uid() = user_id);
```

## Testing

### Running Tests

```bash
# Apply test data (uncomment INSERT statements in test file)
psql -d your_database -f sql/test_rpc_aggregate_time_series.sql

# Run specific test queries
psql -d your_database -c "
SELECT * FROM rpc_aggregate_time_series(
  '2024-08-18T00:00:00Z'::timestamptz,
  '2024-08-24T23:59:59Z'::timestamptz,
  'test-user-id'::uuid
);
"
```

### Test Scenarios

1. **Zero-filling validation**: Empty date ranges return zero buckets
2. **Boundary dates**: Start and end date handling
3. **RLS security**: User data isolation
4. **Metric filtering**: Selective income/spending aggregation
5. **Granularity**: Day/week/month bucket generation
6. **Performance**: Query execution time for various ranges

## Performance Notes

### Optimization Strategies

#### 1. Index Strategy

- Composite indexes on `(user_id, date)` for range queries
- Partial indexes for income/spending to reduce index size
- Consider covering indexes for frequent query patterns

#### 2. Query Optimization

- Metric-specific filtering reduces computation
- `generate_series` with explicit step intervals
- Efficient date truncation using `date_trunc`

#### 3. Scale Considerations

- For high-volume databases, consider table partitioning by date
- Materialized views for pre-computed daily aggregates
- Query result caching at application level

### Performance Benchmarks

Expected query times for typical ranges:

- 7 days: < 50ms
- 30 days: < 100ms
- 90 days: < 200ms
- 1 year: < 500ms (with proper indexing)

## Acceptance Criteria

### ✅ Core Functionality

- [ ] RPC function creates without errors
- [ ] Returns zero-filled time series for date ranges
- [ ] Accurate income/spending aggregation logic
- [ ] Proper UTC timezone handling
- [ ] Deterministic bucket ordering

### ✅ Security

- [ ] RLS properly isolates user data
- [ ] Service role calls with explicit user_id work
- [ ] No data leakage between users
- [ ] Proper authentication handling

### ✅ Flexibility

- [ ] Multiple granularity options (day/week/month)
- [ ] Selective metrics (income, spending, or both)
- [ ] Configurable date ranges
- [ ] Future extensibility for additional metrics

### ✅ Integration

- [ ] Next.js API route integration works
- [ ] Response format matches API specification
- [ ] Error handling and validation
- [ ] Cache headers properly set

### ✅ Testing

- [ ] All test scenarios pass
- [ ] Zero-filling works correctly
- [ ] Edge cases handled gracefully
- [ ] Performance meets requirements

## Troubleshooting

### Common Issues

#### 1. Function Not Found

```sql
-- Check if function exists
\df rpc_aggregate_time_series

-- Verify search path
SHOW search_path;
```

#### 2. RLS Blocking Queries

```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'transactions';

-- Temporarily disable RLS for testing (not for production)
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
```

#### 3. Performance Issues

```sql
-- Analyze query execution plan
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM rpc_aggregate_time_series(
  '2024-08-18T00:00:00Z'::timestamptz,
  '2024-08-24T23:59:59Z'::timestamptz
);

-- Check index usage
SELECT * FROM pg_stat_user_indexes
WHERE tablename = 'transactions';
```

#### 4. Timezone Issues

```sql
-- Verify timezone settings
SHOW timezone;

-- Test timezone conversion
SELECT
  date,
  date AT TIME ZONE 'UTC' as utc_time,
  date_trunc('day', date AT TIME ZONE 'UTC') as bucket
FROM transactions LIMIT 5;
```

## Future Extensions

### Additional Metrics

- Transaction count by category
- Average transaction amounts
- Net cash flow (income - spending)
- Category-specific aggregations

### Enhanced Granularities

- Hourly buckets for intraday analysis
- Custom interval specifications
- Fiscal period alignments

### Advanced Features

- Moving averages and trend calculations
- Comparative period analysis (current vs previous)
- Forecasting and predictive metrics
- Multi-account aggregation

### Performance Enhancements

- Materialized view for daily aggregates
- Automated partition management
- Query result caching strategies
- Database-level caching with `pg_cron`

## Migration Rollback

If you need to remove the function:

```sql
-- Drop the function
DROP FUNCTION IF EXISTS rpc_aggregate_time_series(timestamptz, timestamptz, uuid, text, text[]);

-- Remove indexes (optional)
DROP INDEX IF EXISTS idx_transactions_user_date;
DROP INDEX IF EXISTS idx_transactions_user_amount;
DROP INDEX IF EXISTS idx_transactions_income;
DROP INDEX IF EXISTS idx_transactions_spending;
```

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review the test suite for expected behavior
3. Verify your transactions table schema matches expectations
4. Ensure proper RLS policies are in place
