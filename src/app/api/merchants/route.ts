/**
 * Merchants API Route
 * Returns all merchants with their associated categories for transaction editing
 * Endpoint: GET /api/merchants
 */
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const CACHE_HEADERS = {
  "Cache-Control": "s-maxage=300, stale-while-revalidate=600", // 5 min cache, 10 min stale
};

interface MerchantData {
  merchant_id: string;  // Fixed: merchants table uses merchant_id
  name: string;
  logo_url: string | null;
  categories:
    | {
        category_id: string;  // Fixed: categories table uses category_id
        name: string;
        icon: string;
      }
    | {
        category_id: string;  // Fixed: categories table uses category_id
        name: string;
        icon: string;
      }[]
    | null;
}

export async function GET() {
  const requestId = `merchants_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
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
        {
          status: 401,
          headers: { ...CACHE_HEADERS, "X-Request-ID": requestId },
        }
      );
    }

    // Fetch merchants with their categories
    const { data, error } = await supabase
      .from("merchants")
      .select(
        `
        merchant_id,
        name,
        logo_url,
        categories (
          category_id,
          name,
          icon
        )
      `
      )
      .order("name");

    if (error) {
      console.error("[merchants] Supabase error:", error.message);
      return NextResponse.json(
        { error: "Database Error", message: "Failed to fetch merchants" },
        {
          status: 500,
          headers: { ...CACHE_HEADERS, "X-Request-ID": requestId },
        }
      );
    }

    // Transform the data to a more usable format
    const merchants = ((data as MerchantData[]) || []).map((merchant) => {
      // Handle categories - take the first one if multiple exist
      let category = null;
      if (merchant.categories) {
        if (
          Array.isArray(merchant.categories) &&
          merchant.categories.length > 0
        ) {
          category = merchant.categories[0];
        } else if (!Array.isArray(merchant.categories)) {
          category = merchant.categories;
        }
      }

      return {
        id: merchant.merchant_id,
        name: merchant.name,
        logoUrl: merchant.logo_url,
        category: category
          ? {
              id: category.category_id,
              name: category.name,
              icon: category.icon,
            }
          : null,
      };
    });

    return NextResponse.json(
      {
        data: merchants,
        metadata: {
          total: merchants.length,
          requestId,
        },
      },
      { headers: { ...CACHE_HEADERS, "X-Request-ID": requestId } }
    );
  } catch (err) {
    console.error("[merchants] Unexpected error", err);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred",
      },
      { status: 500, headers: { ...CACHE_HEADERS, "X-Request-ID": requestId } }
    );
  }
}
