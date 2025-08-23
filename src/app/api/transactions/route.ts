import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

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

    // Fetch transactions using service role (bypasses RLS)
    const { data, error, status } = await serviceSupabase
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
      .eq("user_id", user.id) // Filter by authenticated user's ID
      .order("date", { ascending: false });

    if (error) {
      console.error("Supabase Error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        status: status,
      });
      return NextResponse.json(
        { error: "Could not fetch transaction data" },
        { status: 500 }
      );
    }

    console.log(
      `API: Fetched ${data?.length || 0} transactions for user ${user.id}`
    );

    return NextResponse.json(data);
  } catch (err) {
    console.error("API route unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
