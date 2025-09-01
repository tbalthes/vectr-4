/**
 * Categories with Icons API Route
 * Returns all categories used by the current user's transactions, including their icons
 * Endpoint: GET /api/categories/with-icons
 */
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const CACHE_HEADERS = {
  "Cache-Control": "s-maxage=300, stale-while-revalidate=600", // 5 min cache
};

export interface CategoryWithIcon {
  id: string;
  name: string;
  icon: string;
  transaction_count?: number;
}

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { data: sessionRes } = await supabase.auth.getSession();
    const user = sessionRes.session?.user;

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Valid authentication required" },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    // Query to get all unique categories from user's transactions
    const { data: categoriesData, error } = await supabase
      .from("transactions")
      .select(
        `
        merchants (
          categories (
            id,
            name,
            icon
          )
        )
      `
      )
      .eq("user_id", user.id)
      .not("merchants", "is", null)
      .not("merchants.categories", "is", null);

    if (error) {
      console.error("Error fetching categories:", error);
      return NextResponse.json(
        { error: "Database error", message: error.message },
        { status: 500, headers: CACHE_HEADERS }
      );
    }

    // Group by category and count transactions
    const categoryMap = new Map<string, CategoryWithIcon>();

    if (categoriesData) {
      categoriesData.forEach((row: Record<string, unknown>) => {
        const merchant = row.merchants as Record<string, unknown> | null;
        if (!merchant?.categories) return;

        const categories = Array.isArray(merchant.categories)
          ? merchant.categories
          : [merchant.categories];

        categories.forEach((category: Record<string, unknown>) => {
          if (!category?.id || !category?.name) return;

          const categoryKey = String(category.name);

          if (categoryMap.has(categoryKey)) {
            // Increment count
            const existing = categoryMap.get(categoryKey)!;
            existing.transaction_count = (existing.transaction_count || 0) + 1;
          } else {
            // Create new entry
            categoryMap.set(categoryKey, {
              id: String(category.id),
              name: String(category.name),
              icon: String(category.icon || "📋"),
              transaction_count: 1,
            });
          }
        });
      });
    }

    // Convert to array and sort by name
    const categories = Array.from(categoryMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return NextResponse.json(
      {
        data: categories,
        total: categories.length,
      },
      {
        status: 200,
        headers: CACHE_HEADERS,
      }
    );
  } catch (error) {
    console.error("Unexpected error in categories/with-icons API:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred",
      },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}
