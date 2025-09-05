import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// GET /api/accounts
// Returns accounts joined with latest balance and institution meta
export async function GET() {
  try {
    const cookieStore = await cookies();

    // Get all cookies for debugging
    const allCookies = cookieStore.getAll();
    console.log(
      "All available cookies:",
      allCookies.map((c) => ({ name: c.name, hasValue: !!c.value }))
    );

    // Try to find Supabase auth token with various patterns
    let authToken = null;

    // Pattern 1: Exact match for known project
    authToken = cookieStore.get("sb-htcjadaqeuydztascaqc-auth-token");

    // Pattern 2: Any Supabase auth token
    if (!authToken) {
      authToken = allCookies.find(
        (cookie) =>
          cookie.name.includes("auth-token") && cookie.name.startsWith("sb-")
      );
    }

    // Pattern 3: Look for any supabase session token
    if (!authToken) {
      authToken = allCookies.find(
        (cookie) =>
          (cookie.name.includes("supabase") || cookie.name.startsWith("sb-")) &&
          (cookie.name.includes("token") || cookie.name.includes("session"))
      );
    }

    // Pattern 4: Try to parse the auth token from a session cookie
    if (!authToken) {
      const sessionCookie = allCookies.find(
        (cookie) =>
          cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")
      );
      if (sessionCookie) {
        authToken = sessionCookie;
      }
    }

    if (!authToken) {
      console.log("No auth token found in cookies");
      return NextResponse.json(
        {
          error: "No auth token found",
          debug: {
            availableCookies: allCookies.map((c) => c.name),
            message: "Please ensure you are logged in",
          },
        },
        { status: 401 }
      );
    }

    console.log("Using auth token from cookie:", authToken.name);

    // Try to parse the token value if it's a JSON object
    const tokenValue = authToken.value;
    let accessToken = null;
    let refreshToken = null;

    try {
      const parsed = JSON.parse(tokenValue);
      console.log("Parsed token structure:", Object.keys(parsed));

      // Handle array format (Supabase often stores session as [access_token, refresh_token, ...])
      if (Array.isArray(parsed) && parsed.length >= 2) {
        console.log("Token is an array, extracting access and refresh tokens");
        accessToken = parsed[0];
        refreshToken = parsed[1];
        console.log("Extracted tokens:", {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
        });
      } else if (parsed.access_token) {
        accessToken = parsed.access_token;
        refreshToken = parsed.refresh_token;
        console.log("Found access_token in parsed JSON");
      } else {
        console.log("No access_token found in parsed JSON, using full value");
        accessToken = tokenValue;
      }
    } catch {
      // Token value is not JSON, use as-is
      console.log("Token is not JSON, using as-is");
      accessToken = tokenValue;
    }

    // Create Supabase client with the auth token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false, // Disable auto refresh to avoid refresh token errors
        persistSession: false, // Don't persist session in this context
      },
    });

    // Try to get user info directly from the token instead of using getSession
    const { data: user, error: userError } = await supabase.auth.getUser();

    console.log("User check result:", {
      hasUser: !!user?.user,
      userError: userError?.message,
    });

    if (userError || !user?.user) {
      console.log(
        "User validation failed:",
        userError?.message || "No user found"
      );
      return NextResponse.json(
        {
          error: "User validation failed",
          details: userError?.message || "No user found",
        },
        { status: 401 }
      );
    }

    const userId = user.user.id;

    // Prefer explicit filter by user_id to reduce payload size (RLS still enforced)
    const { data, error } = await supabase
      .from("v_accounts_with_latest_balance")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map account_id to id for frontend compatibility
    const mappedAccounts = (data || []).map((account) => ({
      ...account,
      id: account.account_id, // Map account_id to id
    }));

    return NextResponse.json({ accounts: mappedAccounts });
  } catch (error) {
    console.error("Error in /api/accounts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
