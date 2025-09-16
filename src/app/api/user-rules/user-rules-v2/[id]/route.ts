/**
 * Individual Rule API Proxy - Proxies requests for specific rules to FastAPI backend
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const FASTAPI_BASE = 'http://localhost:8000';

export async function PUT(request: NextRequest) {
  try {
    // Extract id from URL path
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const id = segments[segments.length - 1];

    const body = await request.json();
    const searchParams = url.searchParams;

    const fastApiUrl = `${FASTAPI_BASE}/user_rules/${id}?${searchParams.toString()}`;

    // forward incoming headers (cookies/auth) to FastAPI
    const forwardHeaders = Object.fromEntries(request.headers.entries());
    forwardHeaders['content-type'] = 'application/json';

    const response = await fetch(fastApiUrl, {
      method: 'PUT',
      headers: forwardHeaders,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FastAPI PUT error:', fastApiUrl, response.status, errorText);
      return NextResponse.json(
        { error: 'FastAPI Error', details: errorText },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying PUT to FastAPI:', error);
    return NextResponse.json(
      {
        error: 'Proxy Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Extract id from URL path
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const id = segments[segments.length - 1];

    const searchParams = url.searchParams;

    const fastApiUrl = `${FASTAPI_BASE}/user_rules/${id}?${searchParams.toString()}`;

    const forwardHeaders = Object.fromEntries(request.headers.entries());
    const response = await fetch(fastApiUrl, {
      method: 'DELETE',
      headers: forwardHeaders,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FastAPI DELETE error:', fastApiUrl, response.status, errorText);
      return NextResponse.json(
        { error: 'FastAPI Error', details: errorText },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying DELETE to FastAPI:', error);
    return NextResponse.json(
      {
        error: 'Proxy Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
