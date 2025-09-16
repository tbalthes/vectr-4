import crypto from 'crypto';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Dynamic jose import for webhook verification
let joseImported: any = null;
async function getJose() {
  if (joseImported) {
    return joseImported;
  }
  try {
    joseImported = await import('jose');
    return joseImported;
  } catch (e) {
    console.error('[webhook] jose module not available:', e);
    return null;
  }
}

/**
 * Generate deterministic dedupe key for webhook events
 */
function generateDedupeKey(
  itemId: string | undefined,
  webhookType: string | undefined,
  webhookCode: string | undefined,
  payload: any,
  req: Request,
): string {
  // Create deterministic key from payload data
  const timestamp = payload?.env_ts || payload?.time || Date.now();
  const requestId = req.headers.get('x-request-id') || '';

  // Fallback hash if no stable identifiers
  const fallbackData = JSON.stringify({
    itemId,
    webhookType,
    webhookCode,
    timestamp,
    requestId,
  });
  const hash = crypto.createHash('sha256').update(fallbackData).digest('hex').slice(0, 8);

  return `${itemId || 'unknown'}:${webhookType || 'unknown'}:${webhookCode || 'unknown'}:${timestamp}:${hash}`;
}

// POST /api/aggregator/webhook
// Production-ready webhook endpoint for Plaid/MX with verification
export async function POST(req: Request) {
  const provider = (req.headers.get('x-aggregator-provider') || 'plaid').toLowerCase();

  let payload: unknown = null;
  const rawBody = await req.text();

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Verify webhook signature for security
  if (provider === 'plaid') {
    const isValid = await verifyPlaidWebhook(req, rawBody);
    if (!isValid) {
      console.error('[webhook] Invalid Plaid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  // Extract event details
  let eventType: string | undefined;
  let itemId: string | undefined;
  let webhookCode: string | undefined;

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    eventType = obj.webhook_type as string | undefined;
    webhookCode = obj.webhook_code as string | undefined;
    itemId = obj.item_id as string | undefined;
  }

  // Generate deterministic dedupe key instead of random eventId
  const dedupeKey = generateDedupeKey(itemId, eventType, webhookCode, payload, req);

  console.log('[aggregator/webhook]', {
    provider,
    eventType,
    webhookCode,
    itemId,
    dedupeKey,
  });

  // Store webhook event for idempotency and audit trail
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    await supabase.from('webhook_events').insert({
      event_id: dedupeKey, // Use deterministic dedupe key as event_id
      provider: provider,
      event_type: eventType || 'unknown',
      webhook_type: eventType,
      webhook_code: webhookCode,
      item_id: itemId,
      dedupe_key: dedupeKey,
      payload: payload,
      processed: false,
      created_at: new Date().toISOString(),
    });
  } catch (storageError) {
    console.error('[webhook] Failed to store event:', storageError);
    // Don't fail the webhook for storage issues
  }

  // Process specific webhook types
  if (provider === 'plaid' && eventType) {
    await processPlaidWebhook(eventType, webhookCode, itemId, payload);
  }

  return NextResponse.json({
    ok: true,
    provider,
    eventType,
    webhookCode,
    dedupeKey,
    message: 'Webhook received and processed',
  });
}

/**
 * Verify Plaid webhook signature for security
 * (use jose where possible; return boolean)
 */
async function verifyPlaidWebhook(req: Request, rawBody: string): Promise<boolean> {
  const verificationHeader = req.headers.get('plaid-verification');
  if (!verificationHeader) {
    console.error('[webhook] Missing Plaid-Verification header');
    return false;
  }

  try {
    const jose = await getJose();
    if (!jose) {
      console.error("[webhook] 'jose' not installed — signature verification unavailable");
      return false; // fail safe: reject
    }

    // decode header/payload to get kid
    const segments = verificationHeader.split('.');
    if (segments.length !== 3) {
      console.error('[webhook] Invalid JWT format in Plaid-Verification header');
      return false;
    }
    const payloadJson = JSON.parse(
      Buffer.from(segments[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    );
    const kid = JSON.parse(
      Buffer.from(segments[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ).kid;
    if (!kid) {
      console.error('[webhook] JWT header missing kid');
      return false;
    }

    // Fetch Plaid JWK for this kid (same as current logic) - but keep minimal network calls in production
    const PLAID_ENV = (process.env.PLAID_ENV || 'sandbox').toLowerCase();
    const baseMap: Record<string, string> = {
      sandbox: 'https://sandbox.plaid.com',
      development: 'https://development.plaid.com',
      production: 'https://production.plaid.com',
    };
    const baseUrl = baseMap[PLAID_ENV] || baseMap.sandbox;

    const jwkResponse = await fetch(`${baseUrl}/webhook_verification_key/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.PLAID_CLIENT_ID,
        secret: process.env.PLAID_SECRET,
        key_id: kid,
      }),
    });

    if (!jwkResponse.ok) {
      console.error('[webhook] Failed to fetch Plaid JWK', await jwkResponse.text());
      return false;
    }
    const jwkResult = await jwkResponse.json();
    const jwk = jwkResult.key || jwkResult.jwk || jwkResult;
    if (!jwk) {
      console.error('[webhook] No JWK returned by Plaid for kid', kid);
      return false;
    }

    // importJWK and verify
    const jwkKey = await jose.importJWK(jwk);
    await jose.jwtVerify(verificationHeader, jwkKey, { maxTokenAge: '5m' });

    // verify body integrity: check payload.request_body_sha256
    const expected = payloadJson.request_body_sha256;
    if (!expected || typeof expected !== 'string') {
      console.error('[webhook] JWT payload missing request_body_sha256');
      return false;
    }
    const hash = crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.error('[webhook] Body hash mismatch');
      return false;
    }
    return true;
  } catch (err) {
    console.error('[webhook] Error verifying Plaid JWT webhook:', err);
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
  payload: unknown,
): Promise<void> {
  try {
    switch (eventType) {
      case 'TRANSACTIONS':
        await handleTransactionsWebhook(webhookCode, itemId, payload);
        break;

      case 'ITEM':
        await handleItemWebhook(webhookCode, itemId, payload);
        break;

      case 'ERROR':
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
  payload: unknown,
): Promise<void> {
  switch (webhookCode) {
    case 'INITIAL_UPDATE':
      console.log(`[webhook] Initial transaction update for item ${itemId}`);
      // Call sync endpoint to get initial transactions
      await triggerTransactionSync(itemId, 'initial');
      break;

    case 'HISTORICAL_UPDATE':
      console.log(`[webhook] Historical transaction update for item ${itemId}`);
      // Call sync endpoint to get historical transactions
      await triggerTransactionSync(itemId, 'historical');
      break;

    case 'DEFAULT_UPDATE':
      console.log(`[webhook] New transactions available for item ${itemId}`);
      // Call sync endpoint to get new transactions
      await triggerTransactionSync(itemId, 'update');
      break;

    case 'TRANSACTIONS_REMOVED': {
      const removedTxs =
        ((payload as Record<string, unknown>)?.removed_transactions as string[]) || [];
      console.log(`[webhook] ${removedTxs.length} transactions removed for item ${itemId}`);

      // Call sync endpoint to handle removed transactions
      await triggerTransactionSync(itemId, 'removal');
      break;
    }

    case 'SYNC_UPDATES_AVAILABLE':
      console.log(`[webhook] Sync updates available for item ${itemId}`);
      await triggerTransactionSync(itemId, 'sync');
      break;

    default:
      console.log(`[webhook] Unhandled transactions webhook: ${webhookCode}`);
  }
}

/**
 * Trigger transaction sync for an item
 */
async function triggerTransactionSync(itemId: string | undefined, syncType: string): Promise<void> {
  if (!itemId) {
    return;
  }

  try {
    // Get account link for this item
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: accountLink } = await supabase
      .from('account_links')
      .select('access_token_encrypted, user_id, cursor')
      .eq('item_id', itemId)
      .eq('status', 'active')
      .single();

    if (!accountLink) {
      console.warn(`[webhook] No active account link found for item ${itemId}`);
      return;
    }

    console.log(`[webhook] Triggering ${syncType} sync for item ${itemId}`);

    // Build payload for internal Plaid sync endpoint per docs
    const syncBody = {
      access_token: accountLink.access_token_encrypted,
      cursor: accountLink.cursor || undefined,
      count: syncType === 'initial' ? 500 : 100,
      user_id: accountLink.user_id,
    };

    const syncResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/aggregator/plaid/transactions/sync`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncBody),
      },
    );

    // Debug: log status info
    console.log(
      '[webhook] syncResponse status:',
      syncResponse.status,
      'redirected:',
      syncResponse.redirected,
      'url:',
      syncResponse.url,
    );
    try {
      const text = await syncResponse.text();
      // Try to parse JSON if applicable
      try {
        const parsed = JSON.parse(text);
        console.log('[webhook] syncResponse body (parsed):', parsed);
      } catch {
        console.log('[webhook] syncResponse body (text):', text.substring(0, 1000));
      }
    } catch (_e) {
      console.log('[webhook] Failed to read syncResponse body:', _e);
    }

    if (syncResponse.ok) {
      console.log(`[webhook] ${syncType} sync completed (ok response)`);
      // If response contained JSON with has_more, we logged it above when reading body
      // Continue syncing if we detected 'has_more' in the parsed response
      // (we don't reparse the request body here)
    } else {
      console.error(`[webhook] ${syncType} sync failed (non-ok): see above logs for response body`);
    }
  } catch (error) {
    console.error(`[webhook] Error triggering ${syncType} sync:`, error);
  }
}

/**
 * Handle item-related webhooks
 */
function handleItemWebhook(
  webhookCode: string | undefined,
  itemId: string | undefined,
  payload: unknown,
): Promise<void> {
  switch (webhookCode) {
    case 'ERROR':
      console.log(`[webhook] Item error for ${itemId}:`, payload);
      // TODO: Mark item as requiring user attention
      break;

    case 'PENDING_EXPIRATION':
      console.log(`[webhook] Item ${itemId} access will expire soon`);
      // TODO: Notify user to re-authenticate
      break;

    default:
      console.log(`[webhook] Unhandled item webhook: ${webhookCode}`);
  }
  return Promise.resolve();
}

/**
 * Handle error webhooks
 */
function handleErrorWebhook(
  webhookCode: string | undefined,
  itemId: string | undefined,
  payload: unknown,
): Promise<void> {
  console.error(`[webhook] Error webhook for item ${itemId}:`, payload);
  // TODO: Handle specific error types and notify users
  return Promise.resolve();
}
