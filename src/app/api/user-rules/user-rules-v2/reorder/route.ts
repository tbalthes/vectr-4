import { NextRequest, NextResponse } from "next/server";

const FASTAPI_BASE = "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Expect { user_id: string, rule_ids: string[] }
    const userId = body.user_id || null;
    const ruleIds = body.rule_ids || (Array.isArray(body) ? body : null);

    if (!ruleIds || !Array.isArray(ruleIds)) {
      return NextResponse.json(
        { error: "Invalid payload: rule_ids required as array" },
        { status: 400 }
      );
    }

    // Build FastAPI URL with user_id as query param if provided
    const fastApiUrl = userId
      ? `${FASTAPI_BASE}/user_rules/reorder?user_id=${encodeURIComponent(
          userId
        )}`
      : `${FASTAPI_BASE}/user_rules/reorder`;

    // Forward only essential headers (cookies/auth) to FastAPI to avoid header/content-length mismatch
    const forwardHeaders: Record<string, string> = {
      "content-type": "application/json",
    };
    const cookie = request.headers.get("cookie");
    if (cookie) forwardHeaders["cookie"] = cookie;
    const auth = request.headers.get("authorization");
    if (auth) forwardHeaders["authorization"] = auth;

    const response = await fetch(fastApiUrl, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(ruleIds),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "FastAPI reorder error:",
        `${FASTAPI_BASE}/user_rules/reorder`,
        response.status,
        errorText
      );
      return NextResponse.json(
        { error: "FastAPI Error", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error proxying reorder to FastAPI:", error);
    return NextResponse.json(
      {
        error: "Proxy Error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
