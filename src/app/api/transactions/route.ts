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
}

// Transform raw Supabase data to FormattedTransaction
function transformToFormattedTransaction(
  raw: RawSupabaseTransaction
): FormattedTransaction {
  // Handle the fact that merchants is an array from Supabase join
  const merchant = Array.isArray(raw.merchants)
    ? raw.merchants[0]
    : raw.merchants;
  const category = Array.isArray(merchant?.categories)
    ? merchant?.categories[0]
    : merchant?.categories;

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

    const allowedSortFields = ["date", "amount", "transaction_number"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "date";

    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const pageSize =
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 25;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // --- Count query for pagination metadata ---
    let countQuery = serviceSupabase
      .from("transactions")
      .select("id", { count: "exact", head: false })
      .eq("user_id", user.id);
    if (q) {
      countQuery = countQuery.or(
        `clean_description.ilike.%${q}%,original_description.ilike.%${q}%`
      );
    }
    const { count: totalItems, error: countError } = await countQuery;

    // --- Main data query ---
    let query = serviceSupabase
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
        )
      `
      )
      .eq("user_id", user.id);
    if (q) {
      query = query.or(
        `clean_description.ilike.%${q}%,original_description.ilike.%${q}%`
      );
    }
    query = query.order(sortField, { ascending: sortOrder === "asc" });
    query = query.range(from, to);
    const { data, error, status } = await query;

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
    const formattedData = data?.map(transformToFormattedTransaction) || [];

    return NextResponse.json({ data: formattedData, meta });
  } catch (err) {
    console.error("API route unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
