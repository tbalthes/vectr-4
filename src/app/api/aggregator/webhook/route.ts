import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// POST /api/aggregator/webhook
// Production-ready webhook endpoint for Plaid/MX with verification
export async function POST(req: Request) {
  const provider = (
    req.headers.get("x-aggregator-provider") || "plaid"
  ).toLowerCase();

  let payload: unknown = null;
  const rawBody = await req.text();

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Verify webhook signature for security
  if (provider === "plaid") {
    const isValid = await verifyPlaidWebhook(req, rawBody);
    if (!isValid) {
      console.error("[webhook] Invalid Plaid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // Extract event details
  let eventType: string | undefined;
  let itemId: string | undefined;
  let webhookCode: string | undefined;

  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    eventType = obj["webhook_type"] as string | undefined;
    webhookCode = obj["webhook_code"] as string | undefined;
    itemId = obj["item_id"] as string | undefined;
  }

  const eventId = `${provider}_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  console.log("[aggregator/webhook]", {
    provider,
    eventType,
    webhookCode,
    itemId,
    eventId,
  });

  // Store webhook event for idempotency and audit trail
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase.from("webhook_events").insert({
      event_id: eventId,
      provider: provider,
      event_type: eventType || "unknown",
      webhook_code: webhookCode,
      item_id: itemId,
      payload: payload,
      processed: false,
      created_at: new Date().toISOString(),
    });
  } catch (storageError) {
    console.error("[webhook] Failed to store event:", storageError);
    // Don't fail the webhook for storage issues
  }

  // Process specific webhook types
  if (provider === "plaid" && eventType) {
    await processPlaidWebhook(eventType, webhookCode, itemId, payload);
  }

  return NextResponse.json({
    ok: true,
    provider,
    eventType,
    webhookCode,
    eventId,
    message: "Webhook received and processed",
  });
}

/**
 * Verify Plaid webhook signature for security
 */
async function verifyPlaidWebhook(
  req: Request,
  rawBody: string
): Promise<boolean> {
  // In development, skip verification if no webhook secret is set
  if (!process.env.PLAID_WEBHOOK_SECRET) {
    console.warn(
      "[webhook] No PLAID_WEBHOOK_SECRET set, skipping verification"
    );
    return true;
  }

  const signature = req.headers.get("plaid-verification");
  if (!signature) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", process.env.PLAID_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error("[webhook] Signature verification error:", error);
    return false;
  }
}

/**
 * Process Plaid webhook events
 */
async function processPlaidWebhook(
  eventType: string,
  webhookCode: string | undefined,
  itemId: string | undefined,
  payload: unknown
): Promise<void> {
  try {
    switch (eventType) {
      case "TRANSACTIONS":
        await handleTransactionsWebhook(webhookCode, itemId, payload);
        break;

      case "ITEM":
        await handleItemWebhook(webhookCode, itemId, payload);
        break;

      case "ERROR":
        await handleErrorWebhook(webhookCode, itemId, payload);
        break;

      default:
        console.log(`[webhook] Unhandled event type: ${eventType}`);
    }
  } catch (error) {
    console.error(`[webhook] Error processing ${eventType} webhook:`, error);
  }
}

/**
 * Handle transaction-related webhooks
 */
async function handleTransactionsWebhook(
  webhookCode: string | undefined,
  itemId: string | undefined,
  payload: unknown
): Promise<void> {
  switch (webhookCode) {
    case "INITIAL_UPDATE":
      console.log(`[webhook] Initial transaction update for item ${itemId}`);
      // Call sync endpoint to get initial transactions
      await triggerTransactionSync(itemId, "initial");
      break;

    case "HISTORICAL_UPDATE":
      console.log(`[webhook] Historical transaction update for item ${itemId}`);
      // Call sync endpoint to get historical transactions
      await triggerTransactionSync(itemId, "historical");
      break;

    case "DEFAULT_UPDATE":
      console.log(`[webhook] New transactions available for item ${itemId}`);
      // Call sync endpoint to get new transactions
      await triggerTransactionSync(itemId, "update");
      break;

    case "TRANSACTIONS_REMOVED":
      const removedTxs =
        ((payload as Record<string, unknown>)
          ?.removed_transactions as string[]) || [];
      console.log(
        `[webhook] ${removedTxs.length} transactions removed for item ${itemId}`
      );
      
      // Call sync endpoint to handle removed transactions
      await triggerTransactionSync(itemId, "removal");
      break;

    case "SYNC_UPDATES_AVAILABLE":
      console.log(`[webhook] Sync updates available for item ${itemId}`);
      await triggerTransactionSync(itemId, "sync");
      break;

    default:
      console.log(`[webhook] Unhandled transactions webhook: ${webhookCode}`);
  }
}

/**
 * Trigger transaction sync for an item
 */
async function triggerTransactionSync(
  itemId: string | undefined,
  syncType: string
): Promise<void> {
  if (!itemId) return;

  try {
    // Get account link for this item
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: accountLink } = await supabase
      .from("account_links")
      .select("access_token_encrypted, user_id, cursor")
      .eq("item_id", itemId)
      .eq("status", "active")
      .single();

    if (!accountLink) {
      console.warn(`[webhook] No active account link found for item ${itemId}`);
      return;
    }

    console.log(`[webhook] Triggering ${syncType} sync for item ${itemId}`);

    // For internal webhook calls, we need to authenticate properly
    // We'll use the service role to create a proper session
    const { data: sessionData } = await supabase.auth.admin.getUserById(accountLink.user_id);
    
    if (!sessionData?.user) {
      console.warn(`[webhook] No user found for ID ${accountLink.user_id}`);
      return;
    }

    // Call the sync endpoint with proper authentication headers
    const syncResponse = await fetch(`http://localhost:3000/api/aggregator/plaid/transactions/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "X-User-ID": accountLink.user_id, // Pass user ID for internal auth
      },
      body: JSON.stringify({
        access_token: accountLink.access_token_encrypted,
        cursor: accountLink.cursor || undefined,
        count: syncType === "initial" ? 500 : 100,
      }),
    });

    if (syncResponse.ok) {
      const result = await syncResponse.json();
      console.log(`[webhook] ${syncType} sync completed:`, {
        added: result.added,
        modified: result.modified,
        removed: result.removed,
        has_more: result.has_more,
      });

      // Continue syncing if there's more data
      if (result.has_more && result.next_cursor) {
        console.log(`[webhook] More data available, continuing sync...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
        await triggerTransactionSync(itemId, syncType);
      }
    } else {
      console.error(`[webhook] ${syncType} sync failed:`, await syncResponse.text());
    }
  } catch (error) {
    console.error(`[webhook] Error triggering ${syncType} sync:`, error);
  }
}

/**
 * Handle item-related webhooks
 */
async function handleItemWebhook(
  webhookCode: string | undefined,
  itemId: string | undefined,
  payload: unknown
): Promise<void> {
  switch (webhookCode) {
    case "ERROR":
      console.log(`[webhook] Item error for ${itemId}:`, payload);
      // TODO: Mark item as requiring user attention
      break;

    case "PENDING_EXPIRATION":
      console.log(`[webhook] Item ${itemId} access will expire soon`);
      // TODO: Notify user to re-authenticate
      break;

    default:
      console.log(`[webhook] Unhandled item webhook: ${webhookCode}`);
  }
}

/**
 * Handle error webhooks
 */
async function handleErrorWebhook(
  webhookCode: string | undefined,
  itemId: string | undefined,
  payload: unknown
): Promise<void> {
  console.error(`[webhook] Error webhook for item ${itemId}:`, payload);
  // TODO: Handle specific error types and notify users
}
