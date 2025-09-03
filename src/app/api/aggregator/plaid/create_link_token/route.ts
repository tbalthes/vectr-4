import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

// POST /api/aggregator/plaid/create_link_token
// Returns a link_token from Plaid for frontend Link component
export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const useMock = !process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET;
  if (useMock) {
    return NextResponse.json({ link_token: "mock-link-token" });
  }

  try {
    const configuration = new Configuration({
      basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET,
        },
      },
    });

    const client = new PlaidApi(configuration);

    const linkTokenRequest = {
      user: {
        client_user_id: session.user.id,
      },
      client_name: "Vectr Personal Finance",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en' as const,
    };

    const response = await client.linkTokenCreate(linkTokenRequest);
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Plaid linkTokenCreate error:', error);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
