// Next.js Server-Side Invocation Example
// File: src/app/api/analytics/aggregator/route.ts
// This demonstrates how to call the rpc_aggregate_time_series function
// from a Next.js API route using Supabase client

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Initialize Supabase client with request-scoped authentication
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user session
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
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const granularity = searchParams.get('granularity') || 'day';
    const metricsParam = searchParams.get('metrics') || 'income,spending';

    // Parse metrics array
    const metrics = metricsParam.split(',').map(m => m.trim());

    // Calculate date range based on parameters
    const dateRange = calculateDateRange(range, startParam, endParam);

    // Prepare RPC parameters
    const rpcParams = {
      start_date: dateRange.startDate.toISOString(),
      end_date: dateRange.endDate.toISOString(),
      granularity: granularity,
      metrics: metrics
    };

    // Call the RPC function
    // Note: user_id is omitted to rely on RLS for security
    const { data, error } = await supabase.rpc('rpc_aggregate_time_series', {
      start_date: rpcParams.start_date,
      end_date: rpcParams.end_date,
      granularity: rpcParams.granularity,
      metrics: rpcParams.metrics
    });

    if (error) {
      console.error('RPC Error:', error);
      return NextResponse.json(
        { error: 'Database Error', message: 'Failed to fetch analytics data' },
        { status: 500 }
      );
    }

    // Define a type for the RPC response rows
    type AggregateTimeSeriesRow = {
      bucket_date: string;
      income?: number | null;
      spending?: number | null;
      tx_count: number;
    };

    // Transform RPC response to match API specification format
    const response = {
      data: (data as AggregateTimeSeriesRow[]).map((row) => ({
        bucket: row.bucket_date,
        income: Number(row.income ?? 0),
        spending: Number(row.spending ?? 0)
      })),
      metadata: {
        startDate: dateRange.startDate.toISOString().split('T')[0],
        endDate: dateRange.endDate.toISOString().split('T')[0],
        granularity: granularity,
        totalRecords: (data as AggregateTimeSeriesRow[]).reduce((sum, row) => sum + row.tx_count, 0),
        emptyBuckets: (data as AggregateTimeSeriesRow[]).filter((row) => row.tx_count === 0).length
      },
      requestId: `agg_${Date.now()}_${session.user.id.slice(-8)}`
    };

    // Return with cache headers for performance
    return NextResponse.json(response, {
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
}

// Utility function to calculate date ranges
function calculateDateRange(range: string, startParam?: string | null, endParam?: string | null) {
  const now = new Date();
  const utcNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000); // Convert to UTC

  // Explicit start/end dates override range
  if (startParam && endParam) {
    return {
      startDate: new Date(startParam),
      endDate: new Date(endParam)
    };
  }

  // Calculate based on range
  let startDate: Date;
  const endDate = new Date(utcNow);

  switch (range) {
    case '7d':
      startDate = new Date(utcNow);
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate = new Date(utcNow);
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate = new Date(utcNow);
      startDate.setDate(startDate.getDate() - 90);
      break;
    case '1M':
      startDate = new Date(utcNow);
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case '3M':
      startDate = new Date(utcNow);
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case '6M':
      startDate = new Date(utcNow);
      startDate.setMonth(startDate.getMonth() - 6);
      break;
    case 'YTD':
      startDate = new Date(utcNow.getFullYear(), 0, 1); // January 1st of current year
      break;
    case '1Y':
      startDate = new Date(utcNow);
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    case 'all':
      // For 'all', use a reasonable default like 2 years back
      startDate = new Date(utcNow);
      startDate.setFullYear(startDate.getFullYear() - 2);
      break;
    default:
      // Default to 30 days
      startDate = new Date(utcNow);
      startDate.setDate(startDate.getDate() - 30);
  }

  return { startDate, endDate };
}

// Alternative: Service-role invocation example (for admin/batch operations)
/*
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Call with explicit user_id for service-role operations
const { data, error } = await supabaseAdmin.rpc('rpc_aggregate_time_series', {
  start_date: '2024-08-18T00:00:00Z',
  end_date: '2024-08-24T23:59:59Z',
  in_user_id: 'specific-user-id', // Explicit user for service-role calls
  granularity: 'day',
  metrics: ['income', 'spending']
});
*/

