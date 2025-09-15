/**
 * Consolidated User Rules API proxy
 * This single optional catch-all route handles:
 *  - /api/user-rules
 *  - /api/user-rules/{id}
 *  - /api/user-rules/export
 *  - /api/user-rules/import
 *  - /api/user-rules/preview
 *  - /api/user-rules/reorder
 *
 * It proxies requests to the FastAPI backend at http://localhost:8000/user_rules
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const FASTAPI_BASE = 'http://localhost:8000';

function stripPrefix(pathname: string) {
  return pathname.replace(/^\/api\/user-rules/, '');
}

function buildFastApiUrl(pathname: string, searchParams: URLSearchParams) {
  const rest = stripPrefix(pathname).split('/').filter(Boolean);
  const base = '/user_rules';

  if (rest.length === 0) {
    const qs = searchParams.toString();
    return qs ? `${FASTAPI_BASE}${base}/?${qs}` : `${FASTAPI_BASE}${base}/`;
  }

  const path = rest.map(encodeURIComponent).join('/');
  const qs = searchParams.toString();
  return qs ? `${FASTAPI_BASE}${base}/${path}?${qs}` : `${FASTAPI_BASE}${base}/${path}`;
}

async function proxyRequest(
  request: NextRequest,
  fastApiUrl: string,
  method: string,
  body?: unknown,
  forwardAllHeaders = true,
) {
  try {
    const headers: Record<string, string> = {};
    if (forwardAllHeaders) {
      for (const [k, v] of request.headers.entries()) {
        if (v !== undefined && v !== null) {
          headers[k] = v;
        }
      }
    } else {
      headers['content-type'] = 'application/json';
      const cookie = request.headers.get('cookie');
      if (cookie) {
        headers.cookie = cookie;
      }
      const auth = request.headers.get('authorization');
      if (auth) {
        headers.authorization = auth;
      }
    }

    if (body !== undefined && body !== null && !headers['content-type']) {
      headers['content-type'] = 'application/json';
    }

    const resp = await fetch(fastApiUrl, {
      method,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });

    const text = await resp.text();
    // try to parse JSON else return text
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!resp.ok) {
      return NextResponse.json(
        { error: 'FastAPI Error', details: parsed },
        { status: resp.status },
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Proxy error to FastAPI:', error);
    return NextResponse.json(
      {
        error: 'Proxy Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const fastApiUrl = buildFastApiUrl(request.nextUrl.pathname, request.nextUrl.searchParams);
  return proxyRequest(request, fastApiUrl, 'GET', undefined, true);
}

export async function POST(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const rest = stripPrefix(pathname).split('/').filter(Boolean);
  const fastApiUrl = buildFastApiUrl(pathname, request.nextUrl.searchParams);

  if (rest[0] === 'reorder') {
    const body = await request.json().catch(() => null);
    let payload: unknown = null;
    if (Array.isArray(body)) {
      // Handle array case
    } else if (
      body &&
      typeof body === 'object' &&
      Object.prototype.hasOwnProperty.call(body as Record<string, unknown>, 'rule_ids')
    ) {
      // Handle object with rule_ids
      payload = (body as Record<string, unknown>).rule_ids;
    }

    return proxyRequest(request, fastApiUrl, 'POST', payload, false);
  }

  const body = await request.json().catch(() => null);
  return proxyRequest(request, fastApiUrl, 'POST', body, true);
}

export async function PUT(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const fastApiUrl = buildFastApiUrl(pathname, request.nextUrl.searchParams);
  const body = await request.json().catch(() => null);
  return proxyRequest(request, fastApiUrl, 'PUT', body, true);
}

export async function DELETE(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const fastApiUrl = buildFastApiUrl(pathname, request.nextUrl.searchParams);
  return proxyRequest(request, fastApiUrl, 'DELETE', undefined, true);
}
