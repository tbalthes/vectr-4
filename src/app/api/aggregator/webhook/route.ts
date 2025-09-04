import { NextResponse } from "next/server";

// POST /api/aggregator/webhook
// Shared webhook endpoint for Plaid/MX; for now just logs the event.
export async function POST(req: Request) {
  const provider = (
    req.headers.get("x-aggregator-provider") || "plaid"
  ).toLowerCase();
  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Derive a basic event type for logging/response without exposing full payload
  let eventType: string | undefined;
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    eventType = (obj["webhook_type"] || obj["type"] || obj["event_type"]) as
      | string
      | undefined;
  }

  // TODO: verify signatures where applicable
  // TODO: store in webhook_events for idempotency
  // TODO: enqueue processing of deltas
  console.log("[aggregator/webhook]", { provider, eventType });

  return NextResponse.json({ ok: true, provider, eventType });
}
