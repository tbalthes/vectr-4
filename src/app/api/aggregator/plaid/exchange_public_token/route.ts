import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode } from "plaid";

// POST /api/aggregator/plaid/exchange_public_token
// Body: { public_token: string }
export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({
    cookies: cookies,
  });
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError)
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const public_token = body?.public_token as string | undefined;
  if (!public_token)
    return NextResponse.json(
      { error: "public_token required" },
      { status: 400 }
    );

  // Validate required environment variables
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    console.error("Missing required Plaid configuration:");
    console.error("- PLAID_CLIENT_ID present:", !!process.env.PLAID_CLIENT_ID);
    console.error("- PLAID_SECRET present:", !!process.env.PLAID_SECRET);
    return NextResponse.json(
      {
        error:
          "Plaid configuration missing. Please set PLAID_CLIENT_ID and PLAID_SECRET environment variables.",
      },
      { status: 500 }
    );
  }

  console.log("Exchange token request received:");
  console.log("- public_token:", public_token.substring(0, 20) + "...");
  console.log("- PLAID_ENV:", process.env.PLAID_ENV || "sandbox");

  try {
    // Plaid integration
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

    console.log("Attempting to exchange public token with Plaid...");

    // Exchange public token for access token
    const exchangeResponse = await client.itemPublicTokenExchange({
      public_token,
    });

    console.log("Public token exchange successful");
    const { access_token, item_id } = exchangeResponse.data;
    console.log("Received access_token and item_id:", {
      item_id,
      access_token_length: access_token.length,
    });

    // Get accounts
    console.log("Fetching accounts from Plaid...");
    const accountsResponse = await client.accountsGet({
      access_token,
    });

    console.log(
      "Accounts fetched successfully, count:",
      accountsResponse.data.accounts.length
    );
    const plaidAccounts = accountsResponse.data.accounts;

    // Get institution info
    console.log("Fetching item info from Plaid...");
    const itemResponse = await client.itemGet({ access_token });
    const institutionId = itemResponse.data.item.institution_id;
    console.log("Item info fetched, institution_id:", institutionId);

    let institution = null;
    if (institutionId) {
      console.log("Fetching institution details from Plaid...");
      const institutionResponse = await client.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      });
      institution = institutionResponse.data.institution;
      console.log("Institution details fetched:", {
        name: institution.name,
        institution_id: institution.institution_id,
        logo: institution.logo,
        primary_color: institution.primary_color,
        url: institution.url,
        has_logo: !!institution.logo,
      });
    }

    // Store institution
    console.log("Storing institution in database...");
    let institutionRecord = null;
    if (institution) {
      console.log("Institution data to store:", {
        id: institution.institution_id,
        name: institution.name,
        logo_url: institution.logo || null,
        has_logo: !!institution.logo,
      });

      // First try to find existing institution
      const { data: existingInstitution } = await supabase
        .from("institutions")
        .select()
        .eq("id", institution.institution_id)
        .single();

      if (existingInstitution) {
        console.log("Institution already exists:", existingInstitution.id);
        institutionRecord = existingInstitution;
      } else {
        // Create new institution with Plaid ID
        const { data, error } = await supabase
          .from("institutions")
          .insert({
            id: institution.institution_id, // Use Plaid institution ID directly
            provider: "plaid",
            name: institution.name,
            logo_url: institution.logo || null,
            url: institution.url || null,
            primary_color: institution.primary_color || null,
            country_codes: institution.country_codes || null,
            metadata: {
              plaid_institution_data: institution,
            },
          })
          .select()
          .single();

        if (error) {
          console.error("Institution insert error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        institutionRecord = data;
        console.log("Institution stored successfully:", institutionRecord.id);
      }
    }

    // Store account_link (encrypted access token)
    console.log("Storing account link in database...");
    const { error: linkError } = await supabase.from("account_links").insert({
      user_id: session.user.id,
      provider: "plaid",
      item_id,
      access_token_encrypted: access_token, // TODO: Encrypt this in production
      status: "active",
      last_synced_at: new Date().toISOString(),
    });

    if (linkError) {
      console.error("Account link insert error:", linkError);
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }
    console.log("Account link stored successfully");

    // Store accounts
    console.log("Storing accounts in database...");
    const accountsToInsert = plaidAccounts.map((account) => ({
      user_id: session.user.id,
      name: account.name,
      mask: account.mask || null,
      type: account.type.toLowerCase(),
      subtype: account.subtype || null,
      currency: account.balances.iso_currency_code || "USD",
      provider: "plaid",
      aggregator_account_id: account.account_id,
      institution_id: institutionRecord?.id || null,
      plaid_access_token: access_token, // Add the access token for each account
      last_synced_at: new Date().toISOString(),
    }));

    console.log("Accounts to insert:", accountsToInsert.length);
    const { data: createdAccounts, error: accountsError } = await supabase
      .from("accounts")
      .insert(accountsToInsert)
      .select();

    if (accountsError) {
      console.error("Accounts insert error:", accountsError);
      return NextResponse.json(
        { error: accountsError.message },
        { status: 500 }
      );
    }
    console.log(
      "Accounts stored successfully, count:",
      createdAccounts?.length
    );

    // Store balances
    console.log("Storing balances in database...");
    const balancesToInsert =
      createdAccounts?.map((account, index) => {
        const plaidAccount = plaidAccounts[index];
        return {
          account_id: account.id,
          balance_amount: plaidAccount.balances.current || 0,
          available:
            plaidAccount.balances.available ||
            plaidAccount.balances.current ||
            0,
          as_of: new Date().toISOString(),
        };
      }) || [];

    if (balancesToInsert.length > 0) {
      const { error: balancesError } = await supabase
        .from("balances")
        .insert(balancesToInsert);

      if (balancesError) {
        console.error("Balances insert error:", balancesError);
        console.warn("Failed to create balances, but continuing...");
      } else {
        console.log(
          "Balances stored successfully, count:",
          balancesToInsert.length
        );
      }
    }

    // Trigger initial transaction sync
    console.log("🔄 Triggering initial transaction sync...");
    try {
      const syncResponse = await fetch(
        `http://localhost:3000/api/aggregator/plaid/transactions/sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Forward the authentication cookies
            Cookie: req.headers.get("cookie") || "",
          },
          body: JSON.stringify({
            access_token,
            count: 500, // Get more transactions on initial sync
          }),
        }
      );

      if (syncResponse.ok) {
        const syncResult = await syncResponse.json();
        console.log("✅ Initial sync completed:", {
          added: syncResult.added,
          accounts: syncResult.accounts?.length || 0,
        });
      } else {
        const errorText = await syncResponse.text();
        console.warn("⚠️ Initial sync failed:", errorText);
      }
    } catch (syncError) {
      console.warn("⚠️ Initial sync error:", syncError);
      // Don't fail the whole flow for sync issues
    }

    console.log("=== PLAID INTEGRATION COMPLETE ===");
    return NextResponse.json({
      ok: true,
      accounts: createdAccounts?.length || 0,
      accountName: createdAccounts?.[0]?.name || "Unknown Account",
    });
  } catch (error) {
    console.error("Plaid token exchange error:", error);
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 }
    );
  }
}
