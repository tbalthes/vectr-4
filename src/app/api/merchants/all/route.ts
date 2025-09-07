/**
 * All Merchants API Route
 * Returns all merchants with transaction counts for the current user
 * Endpoint: GET /api/merchants/all
 */
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const CACHE_HEADERS = {
  "Cache-Control": "s-maxage=300, stale-while-revalidate=600", // 5 min cache
};

export interface MerchantWithCount {
  id: string;
  name: string;
  logo_url: string | null;
  transaction_count: number;
  categories?:
    | {
        category_id: string;  // Fixed: categories table uses category_id
        name: string;
        icon: string;
      }[]
    | null;
}

export async function GET() {
  try {
    const requestCookies = await cookies();
    const supabase = createRouteHandlerClient({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cookies: () => requestCookies as any,
    });

    const { data: sessionRes } = await supabase.auth.getSession();
    const user = sessionRes.session?.user;

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Valid authentication required" },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    // Query to get merchants with transaction counts for the current user
    // First get all unique merchants that have transactions for this user
    const { data: merchantsData, error } = await supabase
      .from("transactions")
      .select(
        `
        merchants (
          merchant_id,
          name,
          logo_url,
          categories (
            category_id,
            name,
            icon
          )
        )
      `
      )
      .eq("user_id", user.id)
      .not("merchants", "is", null);

    if (error) {
      console.error("Error fetching merchants:", error);
      return NextResponse.json(
        { error: "Database error", message: error.message },
        { status: 500, headers: CACHE_HEADERS }
      );
    }

    // Group by merchant and count transactions
    const merchantCounts = new Map<string, MerchantWithCount>();

    if (merchantsData) {
      merchantsData.forEach((row: Record<string, unknown>) => {
        const merchant = row.merchants as Record<string, unknown> | null;
        if (!merchant) return;

        const merchantKey = String(merchant.merchant_id);

        if (merchantCounts.has(merchantKey)) {
          // Increment count
          const existing = merchantCounts.get(merchantKey)!;
          existing.transaction_count += 1;
        } else {
          // Create new entry
          merchantCounts.set(merchantKey, {
            id: String(merchant.merchant_id),
            name: String(merchant.name),
            logo_url: merchant.logo_url as string | null,
            transaction_count: 1,
            categories: Array.isArray(merchant.categories)
              ? merchant.categories
              : merchant.categories
              ? [merchant.categories]
              : null,
          });
        }
      });
    }

    // Convert to array and sort by transaction count (descending)
    const merchants = Array.from(merchantCounts.values()).sort(
      (a, b) => b.transaction_count - a.transaction_count
    );

    return NextResponse.json(
      {
        data: merchants,
        total: merchants.length,
      },
      {
        status: 200,
        headers: CACHE_HEADERS,
      }
    );
  } catch (error) {
    console.error("Unexpected error in merchants/all API:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred",
      },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}
