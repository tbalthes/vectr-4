/**
 * Analytics Aggregator API Route
 * Provides zero-filled time series data for dashboard charts (Income vs Spending MVP)
 *
 * Endpoint: GET /api/analytics/aggregator
 * Authentication: Required (Supabase RLS via cookies)
 * Cache: s-maxage=30, stale-while-revalidate=300
 *
 * Query Parameters:
 * - range: 7d, 30d, 90d, 1M, 3M, 6M, YTD, 1Y, all (default: 30d)
 * - start: ISO date override (YYYY-MM-DD)
 * - end: ISO date override (YYYY-MM-DD)
 * - granularity: day, week, month (optional override)
 *
 * Response: JSON with data array and metadata
 * Security: Uses createRouteHandlerClient with RLS (auth.uid())
 */

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  calculateDateRange,
  validateAnalyticsParams,
} from "@/lib/analytics/calculateDateRange";

// Type definitions for API contract
interface AggregateRow {
  bucket: string; // YYYY-MM-DD format
  income: number;
  spending: number;
  tx_count: number;
}

interface AnalyticsResponse {
  data: AggregateRow[];
  metadata: {
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    granularity: "day" | "week" | "month";
    totalRecords: number;
    emptyBuckets: number;
    requestId: string; // For debugging
  };
}

interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
}

// Cache headers for performance optimization
const CACHE_HEADERS = {
  "Cache-Control": "s-maxage=30, stale-while-revalidate=300",
};

/**
 * GET /api/analytics/aggregator
 * Returns zero-filled time series data for dashboard charts
 */
export async function GET(request: NextRequest) {
  const requestId = `agg_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 8)}`;

  try {
    // Initialize Supabase client with request-scoped authentication
    // The Supabase helper may call `cookies()` synchronously internally which
    // Next.js disallows. Resolve the request cookies first and provide a
    // lightweight synchronous cookie store wrapper that exposes `get`/`set`/`delete`.
    const requestCookies = await cookies();

    // Provide the already-resolved Next.js cookie store directly so the
    // Supabase helper can synchronously read cookies (getSession will work).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createRouteHandlerClient({
      cookies: () => requestCookies as any,
    });

    // Dev-only: log whether any auth headers or cookies appear to be present (no secret values printed)
    try {
      const cookieHeader = request.headers.get("cookie") || "";
      const hasCookie = cookieHeader.length > 0;
      const authHeader =
        request.headers.get("authorization") ||
        request.headers.get("x-supabase-access-token") ||
        "";
      const hasAuthHeader = authHeader.length > 0;
      if (process.env.NODE_ENV !== "production") {
        console.info(
          "[analytics] dev-auth-presence hasCookie=",
          hasCookie,
          "hasAuthHeader=",
          hasAuthHeader
        );
      }
    } catch {
      // ignore
    }

    // Verify authentication
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError || !session?.user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Valid authentication required",
          code: "AUTH_REQUIRED",
        } as ErrorResponse,
        {
          status: 401,
          headers: { ...CACHE_HEADERS, "X-Request-ID": requestId },
        }
      );
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const granularityOverride = searchParams.get("granularity") as
      | "day"
      | "week"
      | "month"
      | null;

    // Validate parameters
    try {
      validateAnalyticsParams(range, start, end);
    } catch (validationError) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message:
            validationError instanceof Error
              ? validationError.message
              : "Invalid parameters",
          code: "INVALID_PARAMS",
        } as ErrorResponse,
        {
          status: 400,
          headers: { ...CACHE_HEADERS, "X-Request-ID": requestId },
        }
      );
    }

    // Calculate date range
    type RangeKey =
      | "7d"
      | "30d"
      | "90d"
      | "1M"
      | "3M"
      | "6M"
      | "YTD"
      | "1Y"
      | "all";
    const dateRange = calculateDateRange(range as RangeKey, start, end);

    // Apply granularity override if provided
    const finalGranularity =
      granularityOverride &&
      ["day", "week", "month"].includes(granularityOverride)
        ? granularityOverride
        : dateRange.granularity;

    // Prepare RPC parameters (must match DB function signature exactly)
    const rpcParams = {
      p_start: dateRange.startDate.toISOString(),
      p_end: dateRange.endDate.toISOString(),
      p_granularity: finalGranularity,
      p_user: session.user.id,
    };

    // DEBUG: print env + request id
    console.info(
      "[analytics] NEXT_PUBLIC_SUPABASE_URL=",
      process.env.NEXT_PUBLIC_SUPABASE_URL
    );
    console.info(
      "[analytics] NEXT_PUBLIC_SUPABASE_ANON_KEY present=",
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    console.info("[analytics] requestId=", requestId, "rpcParams=", rpcParams);

    // Call RPC function (relies on RLS via auth.uid())
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "rpc_aggregate_time_series",
      rpcParams
    );
    if (rpcError) {
      console.error("[analytics] RPC Error:", rpcError.message);
      return NextResponse.json(
        {
          error: "Database Error",
          message: "Failed to fetch analytics data",
          code: "DB_ERROR",
        },
        {
          status: 500,
          headers: { ...CACHE_HEADERS, "X-Request-ID": requestId },
        }
      );
    }

    // Validate RPC response
    if (!rpcData || !Array.isArray(rpcData)) {
      console.error("Invalid RPC response:", rpcData);
      return NextResponse.json(
        {
          error: "Database Error",
          message: "Invalid response from analytics service",
          code: "INVALID_RESPONSE",
        } as ErrorResponse,
        {
          status: 500,
          headers: { ...CACHE_HEADERS, "X-Request-ID": requestId },
        }
      );
    }

    // Transform RPC response to API contract format
    const data: AggregateRow[] = rpcData.map(
      (row: Record<string, unknown>) => ({
        // RPC may return 'bucket' or 'bucket_date' depending on SQL — handle both
        bucket: String(row.bucket ?? row.bucket_date ?? row.bucket_day ?? ""),
        income: Number(row.income ?? row.income_amount ?? 0),
        spending: Number(row.spending ?? row.spending_amount ?? 0),
        tx_count: Number(row.tx_count ?? row.count ?? 0),
      })
    );

    // Calculate metadata
    const totalRecords = data.reduce((sum, row) => sum + row.tx_count, 0);
    const emptyBuckets = data.filter((row) => row.tx_count === 0).length;

    const response: AnalyticsResponse = {
      data,
      metadata: {
        startDate: dateRange.startDate.toISOString().split("T")[0],
        endDate: dateRange.endDate.toISOString().split("T")[0],
        granularity: finalGranularity,
        totalRecords,
        emptyBuckets,
        requestId,
      },
    };

    // Return successful response with cache headers
    return NextResponse.json(response, {
      headers: {
        ...CACHE_HEADERS,
        "X-Request-ID": requestId,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Analytics API Error:", error);

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred",
        code: "INTERNAL_ERROR",
      } as ErrorResponse,
      {
        status: 500,
        headers: { ...CACHE_HEADERS, "X-Request-ID": requestId },
      }
    );
  }
}

/*
MANUAL TESTING EXAMPLES

1. Basic authenticated request (replace cookie with actual session):
curl -i -H "Cookie: sb-access-token=your-session-token-here" \
  "http://localhost:3000/api/analytics/aggregator?range=7d"

Expected: 200 OK with 7 daily buckets, zero-filled for empty days

2. Test different ranges:
curl -i -H "Cookie: sb-access-token=your-session-token-here" \
  "http://localhost:3000/api/analytics/aggregator?range=30d"

Expected: 30 daily buckets with income/spending data

3. Test explicit date range:
curl -i -H "Cookie: sb-access-token=your-session-token-here" \
  "http://localhost:3000/api/analytics/aggregator?start=2024-08-01&end=2024-08-07"

Expected: Buckets from 2024-08-01 to 2024-08-07

4. Test unauthenticated access:
curl -i "http://localhost:3000/api/analytics/aggregator?range=7d"

Expected: 401 Unauthorized

5. Test invalid parameters:
curl -i -H "Cookie: sb-access-token=your-session-token-here" \
  "http://localhost:3000/api/analytics/aggregator?range=invalid"

Expected: 400 Bad Request

SAMPLE RESPONSE FORMAT:

{
  "data": [
    {"bucket": "2024-08-18", "income": 3500.00, "spending": 1200.50, "tx_count": 3},
    {"bucket": "2024-08-19", "income": 0.00, "spending": 850.25, "tx_count": 1},
    {"bucket": "2024-08-20", "income": 2200.00, "spending": 2100.75, "tx_count": 2}
  ],
  "metadata": {
    "startDate": "2024-08-18",
    "endDate": "2024-08-24",
    "granularity": "day",
    "totalRecords": 6,
    "emptyBuckets": 1,
    "requestId": "agg_1723948800000_a1b2c3d4"
  }
}

VERIFICATION STEPS:
1. Start dev server: npm run dev
2. Authenticate in browser to get valid session
3. Use browser dev tools to copy session cookie
4. Run curl commands above with real session token
5. Verify response format matches API specification
6. Test edge cases (empty ranges, different granularities)
7. Confirm cache headers are present in response
8. Verify RLS isolation by testing with different user sessions

SECURITY NOTES:
- Never expose service-role keys or secrets
- RLS ensures user data isolation via auth.uid()
- Request-scoped client prevents session leakage
- All timezone calculations in UTC for consistency
*/
