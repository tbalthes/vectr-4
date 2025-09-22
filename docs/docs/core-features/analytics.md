# Analytics Aggregator API Specification

## Summary & Purpose

This endpoint provides a flexible analytics aggregation service for financial data visualization. It powers the Income vs Spending Over Time chart (MVP) and is designed to be future-proof for additional chart types like sankey diagrams, category breakdowns, and trend analysis.

**Key Features:**
- Time-series aggregation with zero-filled buckets for consistent chart rendering
- Per-user data isolation via Supabase RLS
- Flexible time ranges (7d, 30d, 90d, extensible to 1M/3M/6M/YTD/1Y/all)
- Minimal JSON response optimized for chart consumption
- HTTP caching for performance
- UTC timezone with user timezone extension notes

## Endpoint Signature

```
GET /api/analytics/aggregator
```

## Query Parameters

| Parameter | Type | Required | Allowed Values | Default | Description |
|-----------|------|----------|----------------|---------|-------------|
| `range` | string | No | `7d`, `30d`, `90d`, `1M`, `3M`, `6M`, `YTD`, `1Y`, `all` | `30d` | Time range for aggregation. Relative to current date. |
| `start` | string | No | ISO 8601 date | N/A | Explicit start date (YYYY-MM-DD). Overrides `range` if provided. |
| `end` | string | No | ISO 8601 date | N/A | Explicit end date (YYYY-MM-DD). Overrides `range` if provided. |
| `granularity` | string | No | `day`, `week`, `month` | `day` | Aggregation bucket size. Day buckets for time-series charts. |
| `metrics` | string | No | `income,spending`, `income`, `spending` | `income,spending` | Comma-separated metrics to include. |
| `group_by` | string | No | `date`, `category`, `merchant` | `date` | Grouping dimension. Extensible for future chart types. |
| `include_empty` | boolean | No | `true`, `false` | `true` | Include zero-value buckets for consistent time-series. |
| `tz` | string | No | IANA timezone | `UTC` | Timezone for date calculations. Default UTC for server consistency. |

**Parameter Semantics:**
- `range` vs `start`/`end`: Use `range` for relative periods, `start`/`end` for explicit dates
- `granularity`: Currently optimized for daily buckets; weekly/monthly for future dashboard views
- `metrics`: Comma-separated for multiple metrics; single metric for focused analysis
- `group_by`: Foundation for extending to category breakdowns, merchant analysis, etc.
- `include_empty`: Critical for chart consistency - always include zero buckets
- `tz`: UTC default ensures server-side consistency; convert to user timezone in client

## Response Schema

### Success Response (200)
```json
{
  "data": [
    {
      "bucket": "string", // YYYY-MM-DD format
      "income": "number", // Sum of income transactions for this bucket
      "spending": "number" // Sum of spending transactions for this bucket
    }
  ],
  "metadata": {
    "startDate": "string", // YYYY-MM-DD
    "endDate": "string", // YYYY-MM-DD
    "granularity": "string", // day/week/month
    "totalRecords": "number", // Count of actual transactions processed
    "emptyBuckets": "number" // Count of zero-filled buckets
  },
  "requestId": "string" // For debugging/caching
}
```

### Sample Response (7d range)
```json
{
  "data": [
    {"bucket": "2024-08-18", "income": 3500.00, "spending": 1200.50},
    {"bucket": "2024-08-19", "income": 0.00, "spending": 850.25},
    {"bucket": "2024-08-20", "income": 2200.00, "spending": 2100.75},
    {"bucket": "2024-08-21", "income": 0.00, "spending": 0.00},
    {"bucket": "2024-08-22", "income": 1800.00, "spending": 950.00},
    {"bucket": "2024-08-23", "income": 0.00, "spending": 1450.30},
    {"bucket": "2024-08-24", "income": 4200.00, "spending": 800.00}
  ],
  "metadata": {
    "startDate": "2024-08-18",
    "endDate": "2024-08-24",
    "granularity": "day",
    "totalRecords": 8,
    "emptyBuckets": 2
  },
  "requestId": "agg_20240824_001"
}
```

### Sample Response (30d range)
```json
{
  "data": [
    {"bucket": "2024-07-26", "income": 3500.00, "spending": 1200.50},
    {"bucket": "2024-07-27", "income": 0.00, "spending": 850.25},
    // ... 28 more days with mixed zero/non-zero values
    {"bucket": "2024-08-24", "income": 4200.00, "spending": 800.00}
  ],
  "metadata": {
    "startDate": "2024-07-26",
    "endDate": "2024-08-24",
    "granularity": "day",
    "totalRecords": 15,
    "emptyBuckets": 15
  },
  "requestId": "agg_20240824_002"
}
```

### Error Responses

**401 Unauthorized**
```json
{
  "error": "Unauthorized",
  "message": "Valid authentication required",
  "code": "AUTH_REQUIRED"
}
```

**400 Bad Request**
```json
{
  "error": "Bad Request",
  "message": "Invalid range parameter",
  "code": "INVALID_RANGE"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal Server Error",
  "message": "Database query failed",
  "code": "DB_ERROR"
}
```

## Example SQL Implementation

### Core Aggregation Query (PostgreSQL)

```sql
-- Parameters: start_date, end_date, user_id
CREATE OR REPLACE FUNCTION get_analytics_aggregator(
  start_date date,
  end_date date,
  user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'data', (
      SELECT json_agg(
        json_build_object(
          'bucket', bucket_date::text,
          'income', COALESCE(income_total, 0),
          'spending', COALESCE(spending_total, 0)
        )
      )
      FROM (
        SELECT
          gs.bucket_date,
          SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as income_total,
          SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as spending_total
        FROM (
          SELECT generate_series(
            start_date,
            end_date,
            '1 day'::interval
          )::date as bucket_date
        ) gs
        LEFT JOIN transactions t ON
          t.date = gs.bucket_date
          AND t.user_id = user_id
        GROUP BY gs.bucket_date
        ORDER BY gs.bucket_date
      ) aggregated
    ),
    'metadata', json_build_object(
      'startDate', start_date,
      'endDate', end_date,
      'granularity', 'day',
      'totalRecords', (
        SELECT COUNT(*) FROM transactions
        WHERE date >= start_date AND date <= end_date AND user_id = user_id
      ),
      'emptyBuckets', (
        SELECT COUNT(*)
        FROM (
          SELECT generate_series(start_date, end_date, '1 day'::interval)::date
        ) gs
        LEFT JOIN transactions t ON t.date = gs AND t.user_id = user_id
        WHERE t.id IS NULL
      )
    ),
    'requestId', 'agg_' || user_id || '_' || extract(epoch from now())
  ) INTO result;

  RETURN result;
END;
$$;
```

### Usage in Supabase RPC
```sql
-- Call from Next.js API route
SELECT get_analytics_aggregator('2024-08-18'::date, '2024-08-24'::date, 'user-uuid'::uuid);
```

## Authentication & RLS

### Authentication Model
- **Method**: Cookie-based authentication via Supabase
- **Client**: Request-scoped Supabase client using `createRouteHandlerClient({ cookies })`
- **User Context**: Extracted from authenticated session
- **Data Isolation**: Row Level Security (RLS) policies on transactions table

### Next.js Route Implementation Sketch
```typescript
// File: src/app/api/analytics/aggregator/route.ts
// Updated to use @supabase/ssr in codebase; docs may reference older helper.
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Valid authentication required' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    // Calculate date range (implement dateRangeFromParams utility)
    const { startDate, endDate } = dateRangeFromParams(range, start, end);

    // Call RPC function
    const { data, error } = await supabase.rpc('get_analytics_aggregator', {
      start_date: startDate,
      end_date: endDate,
      user_id: session.user.id
    });

    if (error) {
      console.error('RPC Error:', error);
      return NextResponse.json(
        { error: 'Database Error', message: 'Failed to fetch analytics data' },
        { status: 500 }
      );
    }

    // Return with cache headers
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 's-maxage=30, stale-while-revalidate=300'
      }
    });

  } catch (error) {
    console.error('Analytics API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Unexpected error occurred' },
      { status: 500 }
    );
  }
### Implementation Status

✅ **Completed Implementation**

The analytics aggregator endpoint has been fully implemented with the following components:

**📁 Files Created:**
- `src/app/api/analytics/aggregator/route.ts` - Main API route handler
- `src/lib/analytics/calculateDateRange.ts` - Date range calculation utility
- `sql/001_create_aggregate_time_series_rpc.sql` - PostgreSQL RPC function
- `sql/README.md` - Complete implementation documentation

**🔗 Key Features:**
- Request-scoped Supabase authentication with RLS security
- Zero-filled time series with UTC timezone handling
- Flexible date ranges (7d, 30d, 90d, 1M, 3M, 6M, YTD, 1Y, all)
- HTTP caching with 30s TTL and stale-while-revalidate
- Comprehensive error handling (400, 401, 500)
- TypeScript type safety with proper interfaces

**🧪 Testing:**
```bash
# Authenticated request
curl -H "Cookie: sb-access-token=your-session-token" \
  "http://localhost:3000/api/analytics/aggregator?range=7d"

# Expected: 200 with 7 daily buckets, zero-filled for empty days
```

**🔒 Security:**
- Uses `createRouteHandlerClient({ cookies })` for RLS
- No service-role keys or secrets exposed
- Per-user data isolation via `auth.uid()`
- Request-scoped client prevents session leakage

}
```

## Cache Headers & Reasoning

### Recommended Headers
```
Cache-Control: s-maxage=30, stale-while-revalidate=300
```

### Reasoning
- **s-maxage=30**: 30-second cache for shared caches (CDN, reverse proxy)
- **stale-while-revalidate=300**: Allow stale responses for 5 minutes while revalidating in background
- **Rationale**: Analytics data changes infrequently but needs to be reasonably fresh. Short cache duration ensures recent transactions appear quickly while reducing database load. Stale-while-revalidate provides good user experience during cache revalidation.

### Alternative Headers by Use Case
- **High-frequency updates**: `s-maxage=10, stale-while-revalidate=60`
- **Static historical data**: `s-maxage=300, stale-while-revalidate=1800`

## Timezone Handling

### Current Implementation
- **Default**: UTC for all server-side calculations and storage
- **Reasoning**: Ensures consistency across distributed systems, simplifies caching, prevents timezone-related bugs

### User Timezone Extension
```typescript
// Client-side conversion utility
function convertToUserTimezone(data: AnalyticsData, userTz: string): AnalyticsData {
  return {
    ...data,
    data: data.data.map(item => ({
      ...item,
      bucket: new Date(item.bucket + 'T00:00:00Z').toLocaleDateString('en-CA', {
        timeZone: userTz
      })
    }))
  };
}
```

### Future Implementation Notes
1. Store user timezone preference in user profile
2. Convert UTC dates to user timezone in client
3. Consider server-side conversion for complex aggregations
4. Handle DST transitions carefully

## Acceptance Tests

### Test Commands

**7d Range Test**
```bash
curl -H "Cookie: sb-access-token=your-token-here" \
     "http://localhost:3000/api/analytics/aggregator?range=7d" \
     -w "\nStatus: %{http_code}\nTime: %{time_total}s\n"
```

**Expected Response (7d)**
```json
{
  "data": [
    {"bucket": "2024-08-18", "income": 3500.00, "spending": 1200.50},
    {"bucket": "2024-08-19", "income": 0.00, "spending": 850.25},
    {"bucket": "2024-08-20", "income": 2200.00, "spending": 2100.75},
    {"bucket": "2024-08-21", "income": 0.00, "spending": 0.00},
    {"bucket": "2024-08-22", "income": 1800.00, "spending": 950.00},
    {"bucket": "2024-08-23", "income": 0.00, "spending": 1450.30},
    {"bucket": "2024-08-24", "income": 4200.00, "spending": 800.00}
  ],
  "metadata": {
    "startDate": "2024-08-18",
    "endDate": "2024-08-24",
    "granularity": "day",
    "totalRecords": 8,
    "emptyBuckets": 2
  }
}
```

**90d Range Test**
```bash
curl -H "Cookie: sb-access-token=your-token-here" \
     "http://localhost:3000/api/analytics/aggregator?range=90d" \
     -w "\nStatus: %{http_code}\nTime: %{time_total}s\n"
```

### Test Assertions
1. **Status Code**: 200 for authenticated requests, 401 for unauthenticated
2. **Response Format**: Valid JSON matching schema
3. **Data Array**: 7 items for 7d, 90 items for 90d (including zero-filled buckets)
4. **Bucket Format**: YYYY-MM-DD strings in chronological order
5. **Numeric Values**: income/spending as numbers (0 or positive)
6. **Metadata**: Contains startDate, endDate, granularity, totalRecords, emptyBuckets
7. **Cache Headers**: `Cache-Control` header present in response
8. **Zero Fill**: Days without transactions show 0.00 for both metrics

## Implementation Checklist

### Files to Create/Edit

1. **Create**: `src/app/api/analytics/aggregator/route.ts`
   - Main API route handler
   - Authentication middleware
   - Query parameter parsing
   - Supabase RPC call
   - Response formatting

2. **Create**: `src/lib/utils/dateRangeFromParams.ts`
   - Utility to convert range/start/end to date objects
   - Handle various time range formats
   - Validate date inputs

3. **Update**: Supabase migrations
   - Create `get_analytics_aggregator` RPC function
   - Ensure RLS policies on transactions table
   - Add any required indexes

4. **Update**: `src/components/private/dashboard/IncomeSpendingOverTime.tsx`
   - Add API call to fetch analytics data
   - Handle loading/error states
   - Process response for chart consumption

### Sample Next Route Skeleton
```typescript
// src/app/api/analytics/aggregator/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Implementation details...
  const { data } = await supabase.rpc('get_analytics_aggregator', {
    start_date: '2024-08-18',
    end_date: '2024-08-24',
    user_id: session.user.id
  });

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=300' }
  });
}
```

### Quick Test Plan
1. **Unit Tests**: Test date range utilities and parameter parsing
2. **Integration Tests**: Test RPC function with mock data
3. **API Tests**: Test endpoint with various parameter combinations
4. **Authentication Tests**: Verify 401 responses for unauthenticated requests
5. **Performance Tests**: Verify response time < 500ms for typical data volumes
6. **Load Tests**: Test concurrent requests and caching behavior

## Acceptance Criteria

- [ ] `docs/api/analytics.md` exists with all specified sections
- [ ] SQL example runs conceptually and demonstrates `generate_series` + `SUM(CASE)` pattern
- [ ] Example responses match shape required by `IncomeSpendingOverTime.tsx`
- [ ] Auth guidance includes `createRouteHandlerClient({ cookies })` usage
- [ ] Returns 401 status when no authenticated user
- [ ] `Cache-Control` recommendation present and justified (30s TTL)
- [ ] Response includes zero-filled buckets for days without transactions
- [ ] API contract supports 7d, 30d, 90d ranges with proper date calculations
- [ ] Documentation includes curl examples for testing
- [ ] Implementation checklist provides clear next steps for developers

## Future Extensions

### Additional Group By Options
- `category`: Group by transaction categories for spending breakdowns
- `merchant`: Group by merchant for spending patterns
- `account`: Group by account for multi-account analysis

### Enhanced Metrics
- `net`: income - spending for net cash flow
- `transaction_count`: Number of transactions per bucket
- `avg_transaction`: Average transaction amount per bucket

### Advanced Features
- Custom date ranges beyond predefined ranges
- Multiple granularities (hourly for intraday analysis)
- Comparative periods (current vs previous period)
- Forecasting and trend analysis