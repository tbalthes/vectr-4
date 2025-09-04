import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from "plaid";

// POST /api/aggregator/plaid/create_link_token
// Returns a link_token from Plaid for frontend Link component
export async function POST() {
  console.log("=== CREATE LINK TOKEN REQUEST ===");

  const supabase = createRouteHandlerClient({
    cookies: () => cookies(),
  });
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  console.log("Session check:", { hasSession: !!session, sessionError });

  if (sessionError) {
    console.error("Session error:", sessionError);
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }
  if (!session?.user) {
    console.error("No user session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const useMock = !process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET;
  console.log("Using mock:", useMock);

  if (useMock) {
    console.log("Returning mock link token");
    return NextResponse.json({ link_token: "mock-link-token" });
  }

  console.log("=== PLAID SANDBOX INSTRUCTIONS ===");
  console.log("At phone verification screen:");
  console.log(
    "- Use test phone: 415-555-0010 (new user) or 415-555-0011 (returning user)"
  );
  console.log("- Use test OTP: 123456");
  console.log("- Then select test bank and use: user_good / pass_good");
  console.log("=====================================");

  try {
    const configuration = new Configuration({
      basePath:
        PlaidEnvironments[
          process.env.PLAID_ENV as keyof typeof PlaidEnvironments
        ] || PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
          "PLAID-SECRET": process.env.PLAID_SECRET,
        },
      },
    });

    const client = new PlaidApi(configuration);

    const linkTokenRequest = {
      user: {
        client_user_id: session.user.id,
      },
      client_name: "Vectr Personal Finance",
      products: [Products.Transactions, Products.Auth],
      country_codes: [CountryCode.Us],
      language: "en" as const,
    };

    console.log("Creating Plaid link token with request:", linkTokenRequest);

    console.log("Creating Plaid link token with request:", linkTokenRequest);

    const response = await client.linkTokenCreate(linkTokenRequest);
    console.log("Plaid link token created successfully");
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error("Plaid linkTokenCreate error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as {
        response?: { data?: unknown; status?: number };
      };
      console.error("Plaid API error response:", axiosError.response?.data);
      console.error("Status:", axiosError.response?.status);
    }
    return NextResponse.json(
      { error: "Failed to create link token" },
      { status: 500 }
    );
  }
}
