export const GET = async () => new Response(null, { status: 204 });
export const PUT = async () => new Response(null, { status: 204 });
export const DELETE = async () => new Response(null, { status: 204 });
/**
 * Individual Rule API Proxy - Proxies requests for specific rules to FastAPI backend
 */
import { NextRequest, NextResponse } from "next/server";

const FASTAPI_BASE = "http://localhost:8000";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const body = await request.json();
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const fastApiUrl = `${FASTAPI_BASE}/user_rules/${
      resolvedParams.id
    }?${searchParams.toString()}`;

    // forward incoming headers (cookies/auth) to FastAPI
    const forwardHeaders = Object.fromEntries(request.headers.entries());
    forwardHeaders["content-type"] = "application/json";

    const response = await fetch(fastApiUrl, {
      method: "PUT",
      headers: forwardHeaders,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "FastAPI PUT error:",
        fastApiUrl,
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
    console.error("Error proxying PUT to FastAPI:", error);
    return NextResponse.json(
      {
        error: "Proxy Error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const fastApiUrl = `${FASTAPI_BASE}/user_rules/${
      resolvedParams.id
    }?${searchParams.toString()}`;

    const forwardHeaders = Object.fromEntries(request.headers.entries());
    const response = await fetch(fastApiUrl, {
      method: "DELETE",
      headers: forwardHeaders,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "FastAPI DELETE error:",
        fastApiUrl,
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
    console.error("Error proxying DELETE to FastAPI:", error);
    return NextResponse.json(
      {
        error: "Proxy Error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
