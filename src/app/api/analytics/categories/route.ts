/**
 * Analytics Categories API Route
 * Returns flat rows of category spending suitable for building a sunburst hierarchy.
 * When namesOnly=true, returns just unique category names for filtering.
 * Endpoint: GET /api/analytics/categories
 * Query: range (7d|30d|...), namesOnly (true/false), or start/end ISO dates (YYYY-MM-DD)
 */
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { calculateDateRange, validateAnalyticsParams } from "@/lib/analytics/calculateDateRange";

type RangeKey = "7d" | "30d" | "90d" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "all";

export interface CategoryRow {
  category: string;
  subcategory?: string | null;
  merchant?: string | null;
  amount: number; // positive spend amount
}

const CACHE_HEADERS = {
  "Cache-Control": "s-maxage=30, stale-while-revalidate=300",
};

export async function GET(request: NextRequest) {
  const requestId = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: sessionRes } = await supabase.auth.getSession();
    const user = sessionRes.session?.user;
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Valid authentication required" },
        { status: 401, headers: { ...CACHE_HEADERS, "X-Request-ID": requestId } }
      );
    }

    const { searchParams } = new URL(request.url);
    const range = (searchParams.get("range") || "30d") as RangeKey;
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const namesOnly = searchParams.get("namesOnly") === "true";

    // If namesOnly is true, return just category names without date filtering
    if (namesOnly) {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          merchants (
            categories ( name )
          )
        `
        )
        .eq("user_id", user.id)
        .not("merchants.categories.name", "is", null);

      if (error) {
        console.error("[categories namesOnly] Supabase error:", error.message);
        return NextResponse.json(
          { error: "Database Error", message: "Failed to fetch categories" },
          { status: 500, headers: { ...CACHE_HEADERS, "X-Request-ID": requestId } }
        );
      }

      const categoryNames = new Set<string>();
      type TxRow = {
        merchants: { categories?: { name?: string | null } | { name?: string | null }[] } | null;
      };

      for (const t of (data as TxRow[]) || []) {
        if (t?.merchants?.categories) {
          const categories = Array.isArray(t.merchants.categories)
            ? t.merchants.categories
            : [t.merchants.categories];
          for (const cat of categories) {
            if (cat?.name) {
              categoryNames.add(cat.name);
            }
          }
        }
      }

      return NextResponse.json(
        {
          data: Array.from(categoryNames).sort(),
          metadata: {
            total: categoryNames.size,
            requestId,
          },
        },
        { headers: { ...CACHE_HEADERS, "X-Request-ID": requestId } }
      );
    }

    try {
      validateAnalyticsParams(range, start, end);
    } catch (e) {
      return NextResponse.json(
        { error: "Bad Request", message: e instanceof Error ? e.message : "Invalid params" },
        { status: 400, headers: { ...CACHE_HEADERS, "X-Request-ID": requestId } }
      );
    }

    const dateRange = calculateDateRange(range, start ?? undefined, end ?? undefined);

    // Fetch transactions for this user and date range; select minimal fields to aggregate client-side
    const { data, error } = await supabase
      .from("transactions")
      .select(
        `
        date,
        amount,
        merchants (
          name,
          categories ( name )
        )
      `
      )
      .eq("user_id", user.id)
      .gte("date", dateRange.startDate.toISOString())
      .lte("date", dateRange.endDate.toISOString());

    if (error) {
      console.error("[categories] Supabase error:", error.message);
      return NextResponse.json(
        { error: "Database Error", message: "Failed to fetch transactions" },
        { status: 500, headers: { ...CACHE_HEADERS, "X-Request-ID": requestId } }
      );
    }

    const rows: CategoryRow[] = [];
    type TxRow = {
      amount: number | null;
      merchants: { name?: string | null; categories?: { name?: string | null } | { name?: string | null }[] } | null;
    };
    for (const t of (data as TxRow[]) || []) {
      const amt = Number(t?.amount ?? 0);
      // Only consider spending (negative amounts); convert to positive magnitude
      const spend = amt < 0 ? -amt : 0;
      if (spend <= 0) continue;
      const merchant = t?.merchants?.name || null;
      const category = Array.isArray(t?.merchants?.categories)
        ? (t.merchants!.categories as { name?: string | null }[])[0]?.name || "Uncategorized"
        : (t?.merchants?.categories as { name?: string | null } | undefined)?.name || "Uncategorized";
      rows.push({ category, subcategory: null, merchant, amount: spend });
    }

    const total = rows.reduce((s, r) => s + r.amount, 0);
    return NextResponse.json(
      {
        data: rows,
        metadata: {
          startDate: dateRange.startDate.toISOString().split("T")[0],
          endDate: dateRange.endDate.toISOString().split("T")[0],
          total,
          requestId,
        },
      },
      { headers: { ...CACHE_HEADERS, "X-Request-ID": requestId } }
    );
  } catch (err) {
    console.error("[categories] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal Server Error", message: "An unexpected error occurred" },
      { status: 500, headers: { ...CACHE_HEADERS, "X-Request-ID": requestId } }
    );
  }
}
