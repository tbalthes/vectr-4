/**
 * User Rules V2 Preview API Proxy - Proxies preview requests to FastAPI backend
 */
import { NextRequest, NextResponse } from "next/server";

const FASTAPI_BASE = "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${FASTAPI_BASE}/user_rules_v2/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
    console.error("Error proxying preview to FastAPI:", error);
    return NextResponse.json(
      { error: "Proxy Error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
