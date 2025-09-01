/**
 * User Rules V2 Individual Rule API Proxy - Proxies requests for specific rules to FastAPI backend
 */
import { NextRequest, NextResponse } from "next/server";

const FASTAPI_BASE = "http://localhost:8000";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    const fastApiUrl = `${FASTAPI_BASE}/user_rules_v2/${params.id}?${searchParams.toString()}`;
    
    const response = await fetch(fastApiUrl, {
      method: "PUT",
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
    console.error("Error proxying PUT to FastAPI:", error);
    return NextResponse.json(
      { error: "Proxy Error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    const fastApiUrl = `${FASTAPI_BASE}/user_rules_v2/${params.id}?${searchParams.toString()}`;
    
    const response = await fetch(fastApiUrl, {
      method: "DELETE",
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
    console.error("Error proxying DELETE to FastAPI:", error);
    return NextResponse.json(
      { error: "Proxy Error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
