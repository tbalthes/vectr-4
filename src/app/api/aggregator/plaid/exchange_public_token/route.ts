import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

// POST /api/aggregator/plaid/exchange_public_token
// Body: { public_token: string }
export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const public_token = body?.public_token as string | undefined;
  if (!public_token) return NextResponse.json({ error: "public_token required" }, { status: 400 });

  const useMock = !process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET;
  if (useMock) {
    // In dev, stub an account_link row to simulate a successful exchange
    // NOTE: access_token_encrypted is a placeholder; replace with encrypted storage in prod
    const { error } = await supabase
      .from("account_links")
      .insert({
        user_id: session.user.id,
        provider: "plaid",
        item_id: `mock-item-${Date.now()}`,
        access_token_encrypted: `mock-access-token-from-${public_token}`,
        status: "active",
      });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, mocked: true });
  }

  // TODO: Exchange with Plaid client and store encrypted access token
  // const { data } = await client.itemPublicTokenExchange({ public_token })
  // await upsert account_links with item_id, encrypted access token

  return NextResponse.json({ ok: true });
}
