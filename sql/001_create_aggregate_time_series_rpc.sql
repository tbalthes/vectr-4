-- Migration: Create rpc_aggregate_time_series function
-- Description: Reusable RPC for zero-filled time series aggregation of financial transactions
-- Version: 001
-- Date: 2024-08-25
-- Dependencies: transactions table with columns (id, user_id, date, amount, category_id, account_id)

-- =============================================
-- RECOMMENDED INDEXES (run separately if needed)
-- =============================================

/*
-- Performance indexes for optimal query execution
-- Run these if not already present in your schema

-- Composite index for user + date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_date
ON transactions (user_id, date DESC);

-- Index for amount-based aggregations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_amount
ON transactions (user_id, amount);

-- Partial index for positive amounts (income)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_income
ON transactions (user_id, date, amount)
WHERE amount > 0;

-- Partial index for negative amounts (spending)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_spending
ON transactions (user_id, date, ABS(amount))
WHERE amount < 0;
*/

-- =============================================
-- RLS POLICIES REMINDER
-- =============================================

/*
Ensure these RLS policies exist on the transactions table:

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policy for user data isolation
CREATE POLICY transactions_user_isolation ON transactions
FOR ALL USING (auth.uid() = user_id);

-- Additional policies as needed for your app's access patterns
*/

-- =============================================
-- RPC FUNCTION: rpc_aggregate_time_series
-- =============================================

CREATE OR REPLACE FUNCTION rpc_aggregate_time_series(
  start_date timestamptz,
  end_date timestamptz,
  in_user_id uuid DEFAULT NULL,
  granularity text DEFAULT 'day',
  metrics text[] DEFAULT ARRAY['income', 'spending']
)
RETURNS TABLE(
  bucket_date date,
  income numeric,
  spending numeric,
  tx_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_uuid uuid;
  interval_step interval;
BEGIN
  -- Determine user context
  -- If in_user_id is provided, use it (for service-role calls)
  -- Otherwise, use auth.uid() for RLS context
  user_uuid := COALESCE(in_user_id, auth.uid());

  -- Validate user context
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User context required - provide in_user_id or ensure authenticated user';
  END IF;

  -- Validate date range
  IF start_date IS NULL OR end_date IS NULL THEN
    RAISE EXCEPTION 'Start date and end date are required';
  END IF;

  IF start_date > end_date THEN
    RAISE EXCEPTION 'Start date must be before or equal to end date';
  END IF;

  -- Validate granularity
  IF granularity NOT IN ('day', 'week', 'month') THEN
    RAISE EXCEPTION 'Invalid granularity: %. Supported values: day, week, month', granularity;
  END IF;

  -- Set interval step based on granularity
  CASE granularity
    WHEN 'day' THEN interval_step := '1 day'::interval;
    WHEN 'week' THEN interval_step := '1 week'::interval;
    WHEN 'month' THEN interval_step := '1 month'::interval;
  END CASE;

  -- Return zero-filled time series with aggregations
  RETURN QUERY
  WITH bucket_series AS (
    -- Generate series of buckets using UTC timezone for consistency
    SELECT
      date_trunc(granularity, start_date AT TIME ZONE 'UTC')::date +
      (generate_series(0, (date_trunc(granularity, end_date AT TIME ZONE 'UTC')::date -
                           date_trunc(granularity, start_date AT TIME ZONE 'UTC')::date) /
                           interval_step) * interval_step)::date as bucket_start,

      date_trunc(granularity, start_date AT TIME ZONE 'UTC')::date +
      ((generate_series(0, (date_trunc(granularity, end_date AT TIME ZONE 'UTC')::date -
                            date_trunc(granularity, start_date AT TIME ZONE 'UTC')::date) /
                            interval_step) + 1) * interval_step)::date - '1 day'::interval as bucket_end
  ),
  transaction_aggregates AS (
    -- Aggregate transactions by bucket, handling timezone conversion
    SELECT
      date_trunc(granularity, date AT TIME ZONE 'UTC')::date as tx_bucket,
      COUNT(*) as transaction_count,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income_sum,
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as spending_sum
    FROM transactions
    WHERE
      -- Use UTC for consistent date comparisons
      date >= start_date
      AND date < end_date + interval_step
      AND user_id = user_uuid
      -- Only include requested metrics to optimize query
      AND (
        ('income' = ANY(metrics) AND amount > 0) OR
        ('spending' = ANY(metrics) AND amount < 0)
      )
    GROUP BY date_trunc(granularity, date AT TIME ZONE 'UTC')::date
  )
  SELECT
    bs.bucket_start::date as bucket_date,
    CASE WHEN 'income' = ANY(metrics) THEN COALESCE(ta.income_sum, 0) ELSE 0 END as income,
    CASE WHEN 'spending' = ANY(metrics) THEN COALESCE(ta.spending_sum, 0) ELSE 0 END as spending,
    COALESCE(ta.transaction_count, 0) as tx_count
  FROM bucket_series bs
  LEFT JOIN transaction_aggregates ta ON ta.tx_bucket = bs.bucket_start
  ORDER BY bs.bucket_start;

END;
$$;

-- =============================================
-- GRANTS AND PERMISSIONS
-- =============================================

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION rpc_aggregate_time_series(timestamptz, timestamptz, uuid, text, text[]) TO authenticated;

-- Grant execute permission to service role for admin operations
GRANT EXECUTE ON FUNCTION rpc_aggregate_time_series(timestamptz, timestamptz, uuid, text, text[]) TO service_role;

-- =============================================
-- USAGE EXAMPLES
-- =============================================

/*
-- Example 1: Basic usage with RLS (no user_id needed for authenticated users)
SELECT * FROM rpc_aggregate_time_series(
  '2024-08-18 00:00:00+00'::timestamptz,
  '2024-08-24 23:59:59+00'::timestamptz
);

-- Example 2: With explicit user_id (service role context)
SELECT * FROM rpc_aggregate_time_series(
  '2024-08-18 00:00:00+00'::timestamptz,
  '2024-08-24 23:59:59+00'::timestamptz,
  'user-uuid-here'::uuid
);

-- Example 3: Weekly granularity
SELECT * FROM rpc_aggregate_time_series(
  '2024-08-01 00:00:00+00'::timestamptz,
  '2024-08-31 23:59:59+00'::timestamptz,
  NULL,
  'week'
);

-- Example 4: Income only metric
SELECT * FROM rpc_aggregate_time_series(
  '2024-08-18 00:00:00+00'::timestamptz,
  '2024-08-24 23:59:59+00'::timestamptz,
  NULL,
  'day',
  ARRAY['income']
);
*/

-- =============================================
-- MIGRATION NOTES
-- =============================================

/*
To apply this migration:

1. Connect to your Supabase database
2. Run: \i sql/001_create_aggregate_time_series_rpc.sql
3. Verify the function was created: \df rpc_aggregate_time_series
4. Test with sample data

To rollback (if needed):
DROP FUNCTION IF EXISTS rpc_aggregate_time_series(timestamptz, timestamptz, uuid, text, text[]);

Dependencies:
- PostgreSQL 12+ for generated columns and advanced features
- transactions table with required columns
- RLS enabled on transactions table

Performance Notes:
- For high-volume databases, consider partitioning the transactions table by date
- Monitor query execution plans for ranges > 90 days
- Consider materialized views for frequently accessed date ranges
- The function is optimized for typical dashboard usage (7-90 day ranges)
*/