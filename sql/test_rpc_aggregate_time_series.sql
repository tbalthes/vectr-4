-- SQL Unit Tests for rpc_aggregate_time_series
-- Description: Test fixtures and validation queries for the RPC function
-- Usage: Run these tests after creating the function and inserting test data

-- =============================================
-- SETUP: Create test schema and sample data
-- =============================================

-- Create test schema (optional - for isolation)
-- CREATE SCHEMA IF NOT EXISTS test_analytics;

-- Sample test user ID (use a consistent UUID for testing)
-- In a real scenario, this would be an authenticated user's ID
-- For testing, you can create a test user or use an existing one

-- =============================================
-- TEST DATA INSERTION
-- =============================================

-- Insert sample transactions for testing
-- Note: Replace 'test-user-id' with an actual user ID from your auth.users table

/*
-- Clean up any existing test data
DELETE FROM transactions WHERE user_id = 'test-user-id'::uuid;

-- Insert test transactions across different dates
INSERT INTO transactions (id, user_id, date, amount, category_id, account_id) VALUES
-- August 18, 2024: Mixed transactions
(gen_random_uuid(), 'test-user-id'::uuid, '2024-08-18 09:30:00+00'::timestamptz, 3500.00, gen_random_uuid(), gen_random_uuid()),
(gen_random_uuid(), 'test-user-id'::uuid, '2024-08-18 14:15:00+00'::timestamptz, -1200.50, gen_random_uuid(), gen_random_uuid()),
(gen_random_uuid(), 'test-user-id'::uuid, '2024-08-18 18:45:00+00'::timestamptz, -100.25, gen_random_uuid(), gen_random_uuid()),

-- August 19, 2024: Only spending
(gen_random_uuid(), 'test-user-id'::uuid, '2024-08-19 11:20:00+00'::timestamptz, -850.25, gen_random_uuid(), gen_random_uuid()),

-- August 20, 2024: Mixed transactions
(gen_random_uuid(), 'test-user-id'::uuid, '2024-08-20 08:00:00+00'::timestamptz, 2200.00, gen_random_uuid(), gen_random_uuid()),
(gen_random_uuid(), 'test-user-id'::uuid, '2024-08-20 16:30:00+00'::timestamptz, -2100.75, gen_random_uuid(), gen_random_uuid()),

-- August 21, 2024: No transactions (should be zero-filled)

-- August 22, 2024: Only income
(gen_random_uuid(), 'test-user-id'::uuid, '2024-08-22 10:00:00+00'::timestamptz, 1800.00, gen_random_uuid(), gen_random_uuid()),

-- August 23, 2024: Only spending
(gen_random_uuid(), 'test-user-id'::uuid, '2024-08-23 13:45:00+00'::timestamptz, -1450.30, gen_random_uuid(), gen_random_uuid()),

-- August 24, 2024: Mixed transactions
(gen_random_uuid(), 'test-user-id'::uuid, '2024-08-24 07:15:00+00'::timestamptz, 4200.00, gen_random_uuid(), gen_random_uuid()),
(gen_random_uuid(), 'test-user-id'::uuid, '2024-08-24 19:20:00+00'::timestamptz, -800.00, gen_random_uuid(), gen_random_uuid());
*/

-- =============================================
-- TEST QUERIES
-- =============================================

-- Test 1: Basic 7-day range (should return 7 rows, 2 empty)
-- Expected: 7 rows with proper zero-filling for August 21
SELECT * FROM rpc_aggregate_time_series(
  '2024-08-18 00:00:00+00'::timestamptz,
  '2024-08-24 23:59:59+00'::timestamptz,
  'test-user-id'::uuid,
  'day',
  ARRAY['income', 'spending']
) ORDER BY bucket_date;

-- Expected output:
-- bucket_date | income  | spending | tx_count
-- 2024-08-18  | 5700.00 | 1300.75 | 3
-- 2024-08-19  |    0.00 |  850.25 | 1
-- 2024-08-20  | 2200.00 | 2100.75 | 2
-- 2024-08-21  |    0.00 |    0.00 | 0  <-- Zero-filled
-- 2024-08-22  | 1800.00 |    0.00 | 1
-- 2024-08-23  |    0.00 | 1450.30 | 1
-- 2024-08-24  | 4200.00 |  800.00 | 2

-- Test 2: Income only metric
SELECT * FROM rpc_aggregate_time_series(
  '2024-08-18 00:00:00+00'::timestamptz,
  '2024-08-24 23:59:59+00'::timestamptz,
  'test-user-id'::uuid,
  'day',
  ARRAY['income']
) ORDER BY bucket_date;

-- Expected: Only income values, spending = 0

-- Test 3: Spending only metric
SELECT * FROM rpc_aggregate_time_series(
  '2024-08-18 00:00:00+00'::timestamptz,
  '2024-08-24 23:59:59+00'::timestamptz,
  'test-user-id'::uuid,
  'day',
  ARRAY['spending']
) ORDER BY bucket_date;

-- Expected: Only spending values, income = 0

-- Test 4: Weekly granularity
SELECT * FROM rpc_aggregate_time_series(
  '2024-08-18 00:00:00+00'::timestamptz,
  '2024-08-24 23:59:59+00'::timestamptz,
  'test-user-id'::uuid,
  'week',
  ARRAY['income', 'spending']
) ORDER BY bucket_date;

-- Expected: 1 row for the week containing these dates

-- Test 5: Edge case - empty date range
SELECT * FROM rpc_aggregate_time_series(
  '2024-09-01 00:00:00+00'::timestamptz,
  '2024-09-07 23:59:59+00'::timestamptz,
  'test-user-id'::uuid,
  'day',
  ARRAY['income', 'spending']
) ORDER BY bucket_date;

-- Expected: 7 rows with all zeros

-- Test 6: Edge case - single day range
SELECT * FROM rpc_aggregate_time_series(
  '2024-08-20 00:00:00+00'::timestamptz,
  '2024-08-20 23:59:59+00'::timestamptz,
  'test-user-id'::uuid,
  'day',
  ARRAY['income', 'spending']
) ORDER BY bucket_date;

-- Expected: 1 row with August 20 data

-- =============================================
-- VALIDATION QUERIES
-- =============================================

-- Verify zero-filling works correctly
-- Count of days with no transactions should match empty buckets
WITH test_results AS (
  SELECT * FROM rpc_aggregate_time_series(
    '2024-08-18 00:00:00+00'::timestamptz,
    '2024-08-24 23:59:59+00'::timestamptz,
    'test-user-id'::uuid
  )
)
SELECT
  COUNT(*) as total_buckets,
  COUNT(CASE WHEN tx_count = 0 THEN 1 END) as empty_buckets,
  COUNT(CASE WHEN tx_count > 0 THEN 1 END) as non_empty_buckets,
  SUM(income) as total_income,
  SUM(spending) as total_spending
FROM test_results;

-- Expected: total_buckets = 7, empty_buckets = 1 (August 21)

-- Verify UTC handling by checking date boundaries
SELECT
  date,
  date AT TIME ZONE 'UTC' as utc_time,
  date_trunc('day', date AT TIME ZONE 'UTC') as utc_bucket
FROM transactions
WHERE user_id = 'test-user-id'::uuid
ORDER BY date;

-- =============================================
-- RLS SECURITY TEST
-- =============================================

-- Test that RLS properly isolates user data
-- This should return different results for different users

/*
-- As User A (should only see User A's data)
SET LOCAL auth.uid TO 'user-a-id';
SELECT COUNT(*) FROM rpc_aggregate_time_series(
  '2024-08-18 00:00:00+00'::timestamptz,
  '2024-08-24 23:59:59+00'::timestamptz
);

-- As User B (should only see User B's data)
SET LOCAL auth.uid TO 'user-b-id';
SELECT COUNT(*) FROM rpc_aggregate_time_series(
  '2024-08-18 00:00:00+00'::timestamptz,
  '2024-08-24 23:59:59+00'::timestamptz
);
*/

-- =============================================
-- PERFORMANCE TEST QUERIES
-- =============================================

-- Test query execution time for different ranges
-- \timing on

-- Small range (7 days)
SELECT COUNT(*) FROM rpc_aggregate_time_series(
  '2024-08-18 00:00:00+00'::timestamptz,
  '2024-08-24 23:59:59+00'::timestamptz,
  'test-user-id'::uuid
);

-- Medium range (30 days)
SELECT COUNT(*) FROM rpc_aggregate_time_series(
  '2024-07-26 00:00:00+00'::timestamptz,
  '2024-08-24 23:59:59+00'::timestamptz,
  'test-user-id'::uuid
);

-- Large range (90 days)
SELECT COUNT(*) FROM rpc_aggregate_time_series(
  '2024-05-27 00:00:00+00'::timestamptz,
  '2024-08-24 23:59:59+00'::timestamptz,
  'test-user-id'::uuid
);

-- =============================================
-- CLEANUP
-- =============================================

-- Remove test data when done
-- DELETE FROM transactions WHERE user_id = 'test-user-id'::uuid;

-- =============================================
-- TEST RESULTS INTERPRETATION
-- =============================================

/*
Expected Test Results Summary:

1. Basic 7-day test:
   - Returns exactly 7 rows (one per day)
   - Zero-filling works (August 21 should have 0 income, 0 spending, 0 tx_count)
   - Income and spending calculations are correct
   - Dates are properly ordered

2. Metric filtering:
   - Income-only returns spending = 0 for all rows
   - Spending-only returns income = 0 for all rows
   - Both metrics return correct values

3. Granularity:
   - Weekly aggregation combines multiple days into one bucket
   - Date truncation works correctly at week boundaries

4. Edge cases:
   - Empty ranges return zero-filled buckets
   - Single day ranges work correctly
   - Invalid parameters raise appropriate exceptions

5. Performance:
   - Queries should complete in < 100ms for typical ranges
   - Larger ranges may take longer but should still be reasonable

6. Security:
   - RLS properly isolates user data
   - Service role calls with explicit user_id work correctly
*/

-- =============================================
-- pgTAP EXTENSION TESTS (if available)
-- =============================================

/*
-- If you have pgTAP installed, you can run these tests:

-- Basic functionality test
SELECT * FROM runtests(
  'test_analytics'::name
);

-- Or create specific tests:

-- Test zero-filling
CREATE OR REPLACE FUNCTION test.test_zero_filling()
RETURNS SETOF TEXT AS $$
BEGIN
  RETURN NEXT ok(
    (SELECT COUNT(*) FROM rpc_aggregate_time_series(
      '2024-08-18 00:00:00+00'::timestamptz,
      '2024-08-24 23:59:59+00'::timestamptz,
      'test-user-id'::uuid
    )) = 7,
    'Should return 7 buckets for 7-day range'
  );

  RETURN NEXT ok(
    (SELECT COUNT(*) FROM rpc_aggregate_time_series(
      '2024-08-18 00:00:00+00'::timestamptz,
      '2024-08-24 23:59:59+00'::timestamptz,
      'test-user-id'::uuid
    ) WHERE tx_count = 0) = 1,
    'Should have 1 empty bucket (August 21)'
  );
END;
$$ LANGUAGE plpgsql;

-- Run the test
SELECT * FROM test_zero_filling();
*/