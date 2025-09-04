import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { FormattedTransaction } from "@/types/transactions";

export const dynamic = "force-dynamic";

// Type for raw Supabase response
interface RawSupabaseTransaction {
  id: string;
  transaction_number: string;
  date: string;
  clean_description: string;
  amount: number;
  original_description: string;
  balance: number | null;
  user_metadata: Record<string, string | number | boolean> | null;
  needs_review: boolean;
  transaction_note: string | null;
  merchants:
    | {
        name: string;
        logo_url: string | null;
        categories: {
          name: string;
          icon: string;
        }[];
      }[]
    | null;
  transaction_categories:
    | {
        categories?: {
          name: string;
          icon: string | null;
        };
        name?: string;
        icon?: string | null;
      }[]
    | null;
}

// Transform raw Supabase data to FormattedTransaction
function transformToFormattedTransaction(
  raw: RawSupabaseTransaction
): FormattedTransaction {
  // Handle the fact that merchants is an array from Supabase join
  const merchant = Array.isArray(raw.merchants)
    ? raw.merchants[0]
    : raw.merchants;
  const merchantCategory = Array.isArray(merchant?.categories)
    ? merchant?.categories[0]
    : merchant?.categories;

  // Check for user category override first
  // transaction_categories can be either an array of objects with a nested
  // `categories` property (PostgREST join style) or a flattened array where
  // each entry directly has `name` and `icon`. Handle both shapes.
  let userCategory: { name?: string; icon?: string | null } | undefined;
  if (
    Array.isArray(raw.transaction_categories) &&
    raw.transaction_categories.length > 0
  ) {
    const first = raw.transaction_categories[0];
    if (first?.categories) {
      userCategory = first.categories;
    } else if (first?.name) {
      userCategory = { name: first.name, icon: first.icon ?? null };
    }
  }

  // If the backend stored a manual_category into user_metadata as a
  // fallback (e.g., when join-table updates failed), prefer that value.
  try {
    const meta = raw.user_metadata as Record<string, unknown> | null;
    const manual =
      meta && typeof meta === "object" ? meta["manual_category"] : undefined;
    if (!userCategory && manual && typeof manual === "string") {
      userCategory = { name: manual, icon: null };
    }
  } catch (err) {
    // ignore
    void err;
  }

  // Prioritize user category over merchant category
  const category = userCategory || merchantCategory;

  return {
    id: raw.id,
    transaction_number: raw.transaction_number,
    date: raw.date,
    description: merchant?.name || raw.clean_description,
    amount: raw.amount,
    originalDescription: raw.original_description,
    balance: raw.balance,
    userMetadata: raw.user_metadata,
    needsReview: raw.needs_review,
    merchantName: merchant?.name || "Unknown",
    merchantLogoUrl: merchant?.logo_url || null,
    categoryName: category?.name || "Uncategorized",
    categoryIcon: category?.icon || "HelpCircle",
    // Add required fields for compatibility
    type: raw.amount > 0 ? "income" : "expense",
    category: category?.name || "Uncategorized",
    account: "Primary", // Default value for now
    status: raw.needs_review ? "pending" : "completed",
    note: raw.transaction_note || undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user from the client
    const requestCookies = await cookies();
    const supabase = createRouteHandlerClient({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cookies: () => requestCookies as any,
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Authentication error:", userError);
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    console.log("API: Authenticated user ID:", user.id);

    // Create a service role client to bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // --- Pagination, Filtering, Sorting (WBS 1.1, 1.2) ---
    const url = new URL(request.url);
    const pageParam = Number(url.searchParams.get("page") || "1");
    const limitParam = Number(url.searchParams.get("limit") || "25");
    const q = url.searchParams.get("q")?.trim() || "";
    const sortBy = url.searchParams.get("sortBy") || "date";
    const sortOrder =
      (url.searchParams.get("sortOrder") || "desc").toLowerCase() === "asc"
        ? "asc"
        : "desc";

    // New filter parameters
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const category = url.searchParams.get("category");
    const merchants = url.searchParams.get("merchants");
    const amountMin = url.searchParams.get("amountMin");
    const amountMax = url.searchParams.get("amountMax");
    const amountType = url.searchParams.get("amountType"); // "income" | "expense"
    const needsReview = url.searchParams.get("needsReview");

    // Debug logging
    console.log("🔍 API Filter Debug:", {
      category,
      merchants,
      amountType,
      amountMin,
      amountMax,
      dateFrom,
      dateTo,
    });

    // Debug logging
    console.log("API received filter parameters:", {
      dateFrom,
      dateTo,
      category,
      merchants,
      amountType,
      amountMin,
      amountMax,
      needsReview,
      q,
    });

    const allowedSortFields = ["date", "amount", "transaction_number"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "date";

    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const pageSize =
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 25;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Helper function to apply filters to a query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyFilters = (query: any) => {
      // Text search
      if (q) {
        query = query.or(
          `clean_description.ilike.%${q}%,original_description.ilike.%${q}%`
        );
      }

      // Date range filters
      if (dateFrom) {
        query = query.gte("date", dateFrom);
      }
      if (dateTo) {
        query = query.lte("date", dateTo);
      }

      // Amount filters - simplified approach
      if (amountType === "income") {
        query = query.gt("amount", 0);
      } else if (amountType === "expense") {
        query = query.lt("amount", 0);
      }

      // Skip database-level amount range filtering since we'll do post-processing
      // This avoids complex OR queries that can cause parsing errors

      // Status filters
      if (needsReview === "true") {
        query = query.eq("needs_review", true);
      } else if (needsReview === "false") {
        query = query.eq("needs_review", false);
      }

      return query;
    };

    // For category filtering with direct join approach
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyCategoryFilter = (query: any, useInnerJoin: boolean = false) => {
      if (!category || category === "all") {
        return query;
      }

      console.log(
        "🔍 Applying category filter for:",
        category,
        useInnerJoin ? "(inner join)" : "(regular join)"
      );

      // Handle comma-separated categories for multiple selection
      const categoryList = category
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      const hasUncategorized = categoryList.includes("Uncategorized");
      const namedCategories = categoryList.filter((c) => c !== "Uncategorized");

      if (hasUncategorized && namedCategories.length > 0) {
        // Mixed case will be handled by separate queries - don't apply filter here
        // We'll handle this in the main query logic
        return query;
      } else if (hasUncategorized) {
        // Only uncategorized
        return query.is("merchant_id", null);
      } else if (namedCategories.length > 0) {
        // Only named categories - use direct join
        if (namedCategories.length === 1) {
          return query.eq("merchants.categories.name", namedCategories[0]);
        } else {
          return query.in("merchants.categories.name", namedCategories);
        }
      }

      return query;
    };

    // For merchant filtering, we need a special approach since it involves joined data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyMerchantFilter = (query: any, useInnerJoin: boolean = false) => {
      if (!merchants || !merchants.trim()) {
        return query;
      }

      console.log(
        "🏪 Applying merchant filter for:",
        merchants,
        useInnerJoin ? "(inner join)" : "(regular join)"
      );

      const merchantList = merchants
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      if (merchantList.length === 0) {
        return query;
      }

      // For merchant filtering, always use the filtering logic
      // The inner join structure should be handled in the main query building
      if (merchantList.length === 1) {
        return query.eq("merchants.name", merchantList[0]);
      } else {
        return query.in("merchants.name", merchantList);
      }
    };

    // --- Count query for pagination metadata ---
    let countQuery;

    // Determine if we need inner joins for count query
    const needsCategoryInnerJoin =
      category && category !== "all" && !category.includes("Uncategorized");
    const needsMerchantInnerJoin = merchants && merchants.trim();

    if (needsCategoryInnerJoin || needsMerchantInnerJoin) {
      // Need inner joins for proper filtering
      let selectClause = "id";

      if (needsCategoryInnerJoin && needsMerchantInnerJoin) {
        // Both category and merchant filtering
        selectClause = `
          id,
          merchants!inner (
            name,
            categories!inner (
              name
            )
          )
        `;
      } else if (needsCategoryInnerJoin) {
        // Only category filtering with inner join
        selectClause = `
          id,
          merchants!inner (
            categories!inner (
              name
            )
          )
        `;
      } else if (needsMerchantInnerJoin) {
        // Only merchant filtering with inner join
        selectClause = `
          id,
          merchants!inner (
            name
          )
        `;
      }

      countQuery = serviceSupabase
        .from("transactions")
        .select(selectClause, { count: "exact", head: false })
        .eq("user_id", user.id);
    } else if (category && category !== "all") {
      // Category filtering but with uncategorized (use regular structure)
      countQuery = serviceSupabase
        .from("transactions")
        .select("id", { count: "exact", head: false })
        .eq("user_id", user.id);
    } else {
      // No special filtering - use regular structure
      countQuery = serviceSupabase
        .from("transactions")
        .select("id", { count: "exact", head: false })
        .eq("user_id", user.id);
    }

    countQuery = applyFilters(countQuery);
    countQuery = applyCategoryFilter(countQuery, true);
    countQuery = applyMerchantFilter(countQuery);
    const { count: totalItems, error: countError } = await countQuery;

    // --- Main data query ---
    let query;

    // Use the filtering requirements already determined above
    if (needsCategoryInnerJoin || needsMerchantInnerJoin) {
      // Need inner joins for proper filtering
      let selectClause;

      if (needsCategoryInnerJoin && needsMerchantInnerJoin) {
        // Both category and merchant filtering - use inner joins for both
        selectClause = `
          id,
          transaction_number,
          date,
          clean_description,
          amount,
          original_description,
          balance,
          user_metadata,
          needs_review,
          transaction_note,
          merchants!inner (
            name,
            logo_url,
            categories!inner (
              name,
              icon
            )
          ),
          transaction_categories (
            categories (
              name,
              icon
            )
          )
          
        `;
      } else if (needsCategoryInnerJoin) {
        // Only category filtering with inner join (no merchant filter)
        selectClause = `
          id,
          transaction_number,
          date,
          clean_description,
          amount,
          original_description,
          balance,
          user_metadata,
          needs_review,
          transaction_note,
          merchants!inner (
            name,
            logo_url,
            categories!inner (
              name,
              icon
            )
          ),
          transaction_categories (
            categories (
              name,
              icon
            )
          )
        `;
      } else if (needsMerchantInnerJoin) {
        // Only merchant filtering with inner join (no category filter)
        selectClause = `
          id,
          transaction_number,
          date,
          clean_description,
          amount,
          original_description,
          balance,
          user_metadata,
          needs_review,
          transaction_note,
          merchants!inner (
            name,
            logo_url,
            categories (
              name,
              icon
            )
          ),
          transaction_categories (
            categories (
              name,
              icon
            )
          )
        `;
      }

      query = serviceSupabase
        .from("transactions")
        .select(selectClause)
        .eq("user_id", user.id);
    } else {
      // Use regular joins (for uncategorized filtering or no special filtering)
      query = serviceSupabase
        .from("transactions")
        .select(
          `
          id,
          transaction_number,
          date,
          clean_description,
          amount,
          original_description,
          balance,
          user_metadata,
          needs_review,
          transaction_note,
          merchants (
            name,
            logo_url,
            categories (
              name,
              icon
            )
          ),
          transaction_categories (
            categories (
              name,
              icon
            )
          )
        `
        )
        .eq("user_id", user.id);
    }

    query = applyFilters(query);
    query = applyCategoryFilter(query);
    query = applyMerchantFilter(query);
    query = query.order(sortField, { ascending: sortOrder === "asc" });
    query = query.range(from, to);
    const { data, error, status } = await query;

    // Debug logging for filtered data
    if ((category && category !== "all") || (merchants && merchants.trim())) {
      console.log("🔍 Filtered Data Sample:", {
        category: category || "none",
        merchants: merchants || "none",
        totalFound: data?.length,
        firstTransaction: data?.[0]
          ? {
              id: data[0].id,
              description: data[0].clean_description,
              merchants: data[0].merchants,
            }
          : null,
      });
    }

    if (error || countError) {
      console.error("Supabase Error:", {
        message: error?.message || countError?.message,
        details: error?.details || countError?.details,
        hint: error?.hint || countError?.hint,
        code: error?.code || countError?.code,
        status: status,
      });
      return NextResponse.json(
        { error: "Could not fetch transaction data" },
        { status: 500 }
      );
    }

    const meta = {
      totalItems: totalItems ?? 0,
      currentPage: page,
      pageSize,
      hasNextPage: totalItems ? to + 1 < totalItems : false,
    };

    console.log(
      `API: Fetched ${data?.length || 0} transactions for user ${
        user.id
      } (page ${page}, pageSize ${pageSize}, totalItems ${meta.totalItems})`
    );

    // Transform the raw Supabase data to FormattedTransaction format
    let formattedData = data?.map(transformToFormattedTransaction) || [];

    // Post-process amount filtering for absolute values
    // This handles the case where users want to filter by amount range regardless of sign
    if (
      (amountMin !== null && amountMin !== undefined) ||
      (amountMax !== null && amountMax !== undefined)
    ) {
      const minAmount = amountMin ? parseFloat(amountMin) : undefined;
      const maxAmount = amountMax ? parseFloat(amountMax) : undefined;

      formattedData = formattedData.filter(
        (transaction: FormattedTransaction) => {
          const absAmount = Math.abs(transaction.amount);

          // Check minimum amount (absolute value)
          if (minAmount !== undefined && absAmount < minAmount) {
            return false;
          }

          // Check maximum amount (absolute value)
          if (maxAmount !== undefined && absAmount > maxAmount) {
            return false;
          }

          return true;
        }
      );

      console.log(
        `💰 Amount filtering: ${data?.length || 0} -> ${
          formattedData.length
        } transactions (range: $${minAmount || "0"}-$${maxAmount || "∞"})`
      );
    }

    return NextResponse.json({ data: formattedData, meta });
  } catch (err) {
    console.error("API route unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
