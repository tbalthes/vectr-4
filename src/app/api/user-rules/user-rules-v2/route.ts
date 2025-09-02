/**
 * User Rules V2 API Proxy - Proxies requests to FastAPI backend
 */
import { NextRequest, NextResponse } from "next/server";

const FASTAPI_BASE = "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const fastApiUrl = `${FASTAPI_BASE}/user_rules/?${searchParams.toString()}`;

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
    console.error("Error proxying to FastAPI:", error);
    return NextResponse.json(
      {
        error: "Proxy Error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const forwardHeaders = Object.fromEntries(request.headers.entries());
    forwardHeaders["content-type"] = "application/json";

    const response = await fetch(`${FASTAPI_BASE}/user_rules/`, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "FastAPI POST error:",
        `${FASTAPI_BASE}/user_rules/`,
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
    console.error("Error proxying to FastAPI:", error);
    return NextResponse.json(
      {
        error: "Proxy Error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
