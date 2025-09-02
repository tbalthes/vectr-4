/**
 * User Rules V2 Import API Proxy - Proxies import requests to FastAPI backend
 */
import { NextRequest, NextResponse } from "next/server";

const FASTAPI_BASE = "http://localhost:8000";

export const GET = async () => new Response(null, { status: 204 });
export const POST = async () => new Response(null, { status: 204 });
}
