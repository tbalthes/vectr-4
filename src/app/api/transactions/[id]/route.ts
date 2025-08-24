import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

interface DetailedTransaction {
  id: string;
  transaction_number: string;
  date: string;
  clean_description: string;
  original_description: string;
  amount: number;
  balance: number | null;
  user_metadata: Record<string, string | number | boolean> | null;
  needs_review: boolean;
  transaction_note: string | null;
  merchant_name: string;
  merchant_logo_url: string | null;
  category_name: string;
  category_icon: string;
  parent_category_name: string | null;
  custom_fields: Record<string, string | number | boolean>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const transactionId = params.id;
    console.log("API: Fetching detailed transaction:", transactionId, "for user:", user.id);

    // Create a service role client to bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch detailed transaction data with category information
    const { data: transactionData, error: transactionError } = await serviceSupabase
      .from("transactions")
      .select(`
        id,
        transaction_number,
        date,
        clean_description,
        original_description,
        amount,
        balance,
        user_metadata,
        needs_review,
        transaction_note,
        merchants (
          name,
          logo_url,
          categories (
            id,
            name,
            icon,
            parent_id
          )
        )
      `)
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .single();

    if (transactionError || !transactionData) {
      console.error("Transaction fetch error:", transactionError);
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Extract merchant and category data
    const merchant = Array.isArray(transactionData.merchants)
      ? transactionData.merchants[0]
      : transactionData.merchants;

    const category = Array.isArray(merchant?.categories)
      ? merchant?.categories[0]
      : merchant?.categories;

    let parentCategoryName: string | null = null;

    // If category has a parent_id, fetch the parent category
    if (category?.parent_id) {
      const { data: parentCategory, error: parentError } = await serviceSupabase
        .from("categories")
        .select("name")
        .eq("id", category.parent_id)
        .single();

      if (!parentError && parentCategory) {
        parentCategoryName = parentCategory.name;
      }
    }

    // Process custom fields from user_metadata
    const customFields: Record<string, string | number | boolean> = {};
    if (transactionData.user_metadata && typeof transactionData.user_metadata === 'object') {
      Object.entries(transactionData.user_metadata).forEach(([key, value]) => {
        // Skip internal/system fields
        const isSystemField =
          key.startsWith("_") ||
          key.toLowerCase().includes("rowindex") ||
          key.toLowerCase().includes("formattedamount") ||
          key.toLowerCase().includes("index");

        if (!isSystemField && value !== null && value !== undefined && value !== "") {
          // Only include values that match our expected types
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            customFields[key] = value;
          }
        }
      });
    }

    const detailedTransaction: DetailedTransaction = {
      id: transactionData.id,
      transaction_number: transactionData.transaction_number,
      date: transactionData.date,
      clean_description: transactionData.clean_description,
      original_description: transactionData.original_description,
      amount: transactionData.amount,
      balance: transactionData.balance,
      user_metadata: transactionData.user_metadata,
      needs_review: transactionData.needs_review,
      transaction_note: transactionData.transaction_note,
      merchant_name: merchant?.name || "Unknown",
      merchant_logo_url: merchant?.logo_url || null,
      category_name: category?.name || "Uncategorized",
      category_icon: category?.icon || "HelpCircle",
      parent_category_name: parentCategoryName,
      custom_fields: customFields,
    };

    console.log("API: Successfully fetched detailed transaction:", transactionId);

    return NextResponse.json({ data: detailedTransaction });
  } catch (err) {
    console.error("API route unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const transactionId = params.id;
    const updateData = await request.json();

    console.log("API: Updating transaction:", transactionId, "for user:", user.id, "with data:", updateData);

    // Create a service role client to bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Prepare the update object with only allowed fields
    const allowedFields = [
      'date',
      'clean_description',
      'original_description',
      'amount',
      'balance',
      'transaction_note',
      'needs_review'
    ];

    const updateObject: Record<string, string | number | boolean | null> = {};
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateObject[field] = updateData[field];
      }
    }

    // Update the transaction
    const { data: updatedTransaction, error: updateError } = await serviceSupabase
      .from("transactions")
      .update(updateObject)
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError || !updatedTransaction) {
      console.error("Transaction update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update transaction" },
        { status: 400 }
      );
    }

    console.log("API: Successfully updated transaction:", transactionId);

    return NextResponse.json({
      data: updatedTransaction,
      message: "Transaction updated successfully"
    });
  } catch (err) {
    console.error("API route unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const transactionId = params.id;
    console.log("API: Deleting transaction:", transactionId, "for user:", user.id);

    // Create a service role client to bypass RLS
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Delete the transaction
    const { error: deleteError } = await serviceSupabase
      .from("transactions")
      .delete()
      .eq("id", transactionId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Transaction delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete transaction" },
        { status: 400 }
      );
    }

    console.log("API: Successfully deleted transaction:", transactionId);

    return NextResponse.json({
      message: "Transaction deleted successfully"
    });
  } catch (err) {
    console.error("API route unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}