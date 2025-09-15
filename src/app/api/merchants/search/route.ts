/**
 * Enhanced Merchants Search API Route
 * Provides advanced search functionality for merchants with autocomplete support
 * Endpoint: GET /api/merchants/search?q=query&limit=10
 */
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const CACHE_HEADERS = {
  "Cache-Control": "s-maxage=60, stale-while-revalidate=120", // 1 min cache for search results
};

interface MerchantSearchResult {
  merchant_id: string; // Fixed: merchants table uses merchant_id
  name: string;
  logo_url: string | null;
  categories:
    | {
        category_id: string;
        name: string;
        plain_name?: string;
        lucide_icon?: string;
        icon?: string;
      }
    | {
        category_id: string;
        name: string;
        plain_name?: string;
        lucide_icon?: string;
        icon?: string;
      }[]
    | null;
}

export async function GET(request: NextRequest) {
  const requestId = `merchant_search_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  try {
    const requestCookies = await cookies();
    const supabase = createRouteHandlerClient({
       
      cookies: () => requestCookies as any,
    });

    // Check authentication
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100); // Max 100 results

    // If no query, return recent/popular merchants
    if (!query.trim()) {
      const { data, error } = await supabase
        .from("merchants")
        .select(
          `
          merchant_id,
          name,
          logo_url,
          categories:default_category_id (
            category_id,
            name,
            plain_name,
            lucide_icon,
            icon
          )
        `
        )
        .order("name")
        .limit(limit);

      if (error) {
        console.error("[merchant-search] Supabase error:", error.message);
        return NextResponse.json(
          { error: "Database Error", message: "Failed to fetch merchants" },
          {
            status: 500,
            headers: { ...CACHE_HEADERS, "X-Request-ID": requestId },
          }
        );
      }

      const merchants = transformMerchantData(data as MerchantSearchResult[]);
      return NextResponse.json(
        {
          data: merchants,
          metadata: {
            total: merchants.length,
            query: "",
            requestId,
          },
        },
        { headers: { ...CACHE_HEADERS, "X-Request-ID": requestId } }
      );
    }

    // Perform search with multiple strategies for better results
    const searchQuery = query.trim().toLowerCase();

    // Strategy 1: Exact name match (highest priority)
    // Strategy 2: Name starts with query
    // Strategy 3: Name contains query anywhere
    // Strategy 4: Fuzzy match using PostgreSQL's similarity

    const { data, error } = await supabase
      .from("merchants")
      .select(
        `
        merchant_id,
        name,
        logo_url,
        categories:default_category_id (
          category_id,
          name,
          plain_name,
          lucide_icon,
          icon
        )
      `
      )
      .ilike("name", `%${searchQuery}%`)
      .order("name")
      .limit(limit);

    if (error) {
      console.error("[merchant-search] Search error:", error.message);
      return NextResponse.json(
        { error: "Search Error", message: "Failed to search merchants" },
        {
          status: 500,
          headers: { ...CACHE_HEADERS, "X-Request-ID": requestId },
        }
      );
    }

    // Transform and rank results
    const merchants = transformMerchantData(data as MerchantSearchResult[]);
    const rankedMerchants = rankSearchResults(merchants, searchQuery);

    return NextResponse.json(
      {
        data: rankedMerchants,
        metadata: {
          total: rankedMerchants.length,
          query: searchQuery,
          requestId,
        },
      },
      { headers: { ...CACHE_HEADERS, "X-Request-ID": requestId } }
    );
  } catch (err) {
    console.error("[merchant-search] Unexpected error:", err);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred during search",
      },
      { status: 500, headers: { ...CACHE_HEADERS, "X-Request-ID": requestId } }
    );
  }
}

function transformMerchantData(data: MerchantSearchResult[]) {
  return (data || []).map((merchant) => {
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
            name: category.plain_name || category.name,
            icon: category.lucide_icon || category.icon || "HelpCircle",
          }
        : null,
    };
  });
}

interface TransformedMerchant {
  id: string;
  name: string;
  logoUrl: string | null;
  category: {
    id: string;
    name: string;
    icon: string;
  } | null;
}

interface ScoredMerchant extends TransformedMerchant {
  searchScore: number;
}

function rankSearchResults(
  merchants: TransformedMerchant[],
  query: string
): TransformedMerchant[] {
  const queryLower = query.toLowerCase();

  return merchants
    .map((merchant): ScoredMerchant => {
      const nameLower = merchant.name.toLowerCase();
      let score = 0;

      // Exact match gets highest score
      if (nameLower === queryLower) {
        score = 100;
      }
      // Starts with query gets high score
      else if (nameLower.startsWith(queryLower)) {
        score = 80;
      }
      // Contains query gets medium score
      else if (nameLower.includes(queryLower)) {
        score = 60;
      }
      // Fallback score
      else {
        score = 20;
      }

      return { ...merchant, searchScore: score };
    })
    .sort((a, b) => b.searchScore - a.searchScore)
    .map((scoredMerchant): TransformedMerchant => {
      // Remove score from final result
       
      const { searchScore: _, ...merchant } = scoredMerchant;
      return merchant;
    });
}
