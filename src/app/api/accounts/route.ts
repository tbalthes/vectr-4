import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

// GET /api/accounts
// Returns accounts joined with latest balance and institution meta
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Prefer explicit filter by user_id to reduce payload size (RLS still enforced)
  const { data, error } = await supabase
    .from("v_accounts_with_latest_balance")
    .select("*")
    .eq("user_id", session.user.id)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ accounts: data ?? [] });
}
