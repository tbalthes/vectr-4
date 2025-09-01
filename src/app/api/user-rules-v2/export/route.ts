/**
 * User Rules V2 Export API Proxy - Proxies export requests to FastAPI backend
 */
import { NextRequest, NextResponse } from "next/server";

const FASTAPI_BASE = "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    const fastApiUrl = `${FASTAPI_BASE}/user_rules_v2/export?${searchParams.toString()}`;
    
    const response = await fetch(fastApiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "FastAPI Error", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error proxying export to FastAPI:", error);
    return NextResponse.json(
      { error: "Proxy Error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
