import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// POST /api/institutions
// Create a new institution (manual or other providers)
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    let authToken = cookieStore.get("sb-htcjadaqeuydztascaqc-auth-token");
    if (!authToken) {
      authToken = allCookies.find(
        (cookie) =>
          cookie.name.includes("auth-token") && cookie.name.startsWith("sb-")
      );
    }
    if (!authToken) {
      return NextResponse.json(
        { error: "No auth token found" },
        { status: 401 }
      );
    }
    const tokenValue = authToken.value;
    let accessToken = null;
    try {
      const parsed = JSON.parse(tokenValue);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        accessToken = parsed[0];
      } else if (parsed.access_token) {
        accessToken = parsed.access_token;
      } else {
        accessToken = tokenValue;
      }
    } catch {
      accessToken = tokenValue;
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Request body required" },
        { status: 400 }
      );
    }

    const {
      name,
      provider = "manual",
      logo_url,
      url,
      primary_color,
      country_codes,
      metadata,
    } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Institution name is required" },
        { status: 400 }
      );
    }

    if (!["manual", "plaid", "mx"].includes(provider)) {
      return NextResponse.json(
        {
          error: "Provider must be one of: manual, plaid, mx",
        },
        { status: 400 }
      );
    }

    // For manual institutions, check for duplicates by name
    if (provider === "manual") {
      const { data: existingInstitution } = await supabase
        .from("institutions")
        .select("id, name")
        .eq("provider", "manual")
        .ilike("name", name.trim())
        .single();

      if (existingInstitution) {
        return NextResponse.json(
          {
            error: "An institution with this name already exists",
            existing: existingInstitution,
          },
          { status: 409 }
        );
      }
    }

    // Create the institution
    const institutionData = {
      id: crypto.randomUUID(), // Generate UUID for the institution
      provider,
      name: name.trim(),
      logo_url: logo_url || null,
      url: url || null,
      primary_color: primary_color || null,
      country_codes: country_codes || null,
      metadata: metadata || null,
    };

    const { data: institution, error: insertError } = await supabase
      .from("institutions")
      .insert(institutionData)
      .select()
      .single();

    if (insertError) {
      console.error("Institution insert error:", insertError);
      return NextResponse.json(
        {
          error: "Failed to create institution",
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(institution);
  } catch (error) {
    console.error("Create institution error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/institutions
// List institutions (optionally filtered by provider)
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    let authToken = cookieStore.get("sb-htcjadaqeuydztascaqc-auth-token");
    if (!authToken) {
      authToken = allCookies.find(
        (cookie) =>
          cookie.name.includes("auth-token") && cookie.name.startsWith("sb-")
      );
    }
    if (!authToken) {
      return NextResponse.json(
        { error: "No auth token found" },
        { status: 401 }
      );
    }
    const tokenValue = authToken.value;
    let accessToken = null;
    try {
      const parsed = JSON.parse(tokenValue);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        accessToken = parsed[0];
      } else if (parsed.access_token) {
        accessToken = parsed.access_token;
      } else {
        accessToken = tokenValue;
      }
    } catch {
      accessToken = tokenValue;
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    let query = supabase.from("institutions").select("*").order("name");

    if (provider) {
      query = query.eq("provider", provider);
    }

    const { data: institutions, error } = await query;

    if (error) {
      console.error("Institutions fetch error:", error);
      return NextResponse.json(
        {
          error: "Failed to fetch institutions",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      institutions: institutions || [],
    });
  } catch (error) {
    console.error("Get institutions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
