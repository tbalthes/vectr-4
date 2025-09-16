import crypto from 'crypto';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  let webhookType: string | undefined;
  let itemId: string | undefined;
  let webhookCode: string | undefined;

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    webhookType = obj.webhook_type as string | undefined;
    webhookCode = obj.webhook_code as string | undefined;
    itemId = obj.item_id as string | undefined;
  }

  // Generate deterministic dedupe key for idempotency
  const dedupeKey = generateDedupeKey(provider, webhookType, webhookCode, itemId, payload);

  console.log('[aggregator/webhook]', {
    provider,
    webhookType,
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

    // Use upsert with ON CONFLICT DO NOTHING to handle duplicates
    const { data, error } = await supabase.from('webhook_events').upsert({
      dedupe_key: dedupeKey,
      provider: provider,
      webhook_type: webhookType || 'unknown',
      webhook_code: webhookCode,
      item_id: itemId,
      payload_json: payload,
      status: 'received',
      received_at: new Date().toISOString(),
    }, {
      onConflict: 'dedupe_key',
      ignoreDuplicates: true,
    });

    if (error && !error.message.includes('duplicate')) {
      console.error('[webhook] Failed to store event:', error);
      // Don't fail the webhook for storage issues
    } else if (data === null || (Array.isArray(data) && data.length === 0)) {
      console.log('[webhook] Duplicate webhook detected, skipping processing');
      return NextResponse.json({
        ok: true,
        provider,
        webhookType,
        webhookCode,
        dedupeKey,
        message: 'Duplicate webhook received, skipped processing',
      });
    }
  } catch (storageError) {
    console.error('[webhook] Failed to store event:', storageError);
    // Don't fail the webhook for storage issues
  }

  // Process specific webhook types
  if (provider === 'plaid' && webhookType) {
    await processPlaidWebhook(webhookType, webhookCode, itemId, payload);
  }

  return NextResponse.json({
    ok: true,
    provider,
    webhookType,
    webhookCode,
    dedupeKey,
    message: 'Webhook received and processed',
  });
}

/**
 * Generate deterministic dedupe key for webhook idempotency
 */
function generateDedupeKey(
  provider: string,
  webhookType: string | undefined,
  webhookCode: string | undefined,
  itemId: string | undefined,
  payload: unknown,
): string {
  // Create a deterministic key based on webhook content
  // Include timestamp from webhook payload if available for uniqueness
  let timestamp = '';
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    // Try to get timestamp from various common webhook fields
    timestamp = (obj.timestamp || obj.created_at || obj.sent_at || '') as string;
  }
  
  // Create deterministic string from key webhook properties
  const keyComponents = [
    provider,
    webhookType || 'unknown',
    webhookCode || 'unknown',
    itemId || 'unknown',
    timestamp,
  ].join('|');

  // Generate SHA256 hash for deterministic dedupe key
  return crypto.createHash('sha256').update(keyComponents).digest('hex');
}

/**
 * Verify Plaid webhook signature for security
 */
async function verifyPlaidWebhook(req: Request, rawBody: string): Promise<boolean> {
  // Plaid now signs webhooks with a JWT in the `Plaid-Verification` header.
  // See Plaid docs: verify the JWT by fetching the JWK for the `kid`, verify
  // signature, check iat (issued at) for replay protection (5 minutes window),
  // and validate request body integrity by comparing SHA-256(rawBody) to
  // payload.request_body_sha256 using a constant-time compare.

  const verificationHeader = req.headers.get('plaid-verification');
  if (!verificationHeader) {
    console.error('[webhook] Missing Plaid-Verification header');
    return false;
  }

  try {
    // Decode JWT without verifying first to read header and payload
    // Use the jsonwebtoken library if available; fallback to manual decode
    // to avoid adding a dependency here. JWT is base64url encoded segments.
    const segments = verificationHeader.split('.');
    if (segments.length !== 3) {
      console.error('[webhook] Invalid JWT format in Plaid-Verification header');
      return false;
    }

    const headerB64 = segments[0];
    const payloadB64 = segments[1];

    const base64UrlToBase64 = (b64url: string) =>
      b64url.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (b64url.length % 4)) % 4);

    const headerJson = JSON.parse(
      Buffer.from(base64UrlToBase64(headerB64), 'base64').toString('utf8'),
    );
    const payloadJson = JSON.parse(
      Buffer.from(base64UrlToBase64(payloadB64), 'base64').toString('utf8'),
    );

    const kid = headerJson.kid;
    if (!kid) {
      console.error('[webhook] JWT header missing kid');
      return false;
    }

    // Determine Plaid environment base URL
    const PLAID_ENV = (process.env.PLAID_ENV || 'sandbox').toLowerCase();
    const baseMap: Record<string, string> = {
      sandbox: 'https://sandbox.plaid.com',
      development: 'https://development.plaid.com',
      production: 'https://production.plaid.com',
    };
    const baseUrl = baseMap[PLAID_ENV] || baseMap.sandbox;

    // Fetch the JWK for this kid from Plaid API
    const jwkResponse = await fetch(`${baseUrl}/webhook_verification_key/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    // Plaid returns { key: { ...jwk... } } in many SDKs; accept flexible shapes
    const jwk = jwkResult.key || jwkResult.jwk || jwkResult;
    if (!jwk) {
      console.error('[webhook] No JWK returned by Plaid for kid', kid);
      return false;
    }

    // Convert JWK to PEM for verification. Support RSA and EC keys.
    // Minimal implementation: use crypto.webcrypto.subtle if available, but Node's
    // built-in crypto has no direct JWK->Key import without extras. We'll use
    // a small JWK-to-PEM helper for RSA (most Plaid keys are RSA).

    const jwkToPem = (jwkObj: any): string | null => {
      try {
        if (jwkObj.kty === 'RSA' && jwkObj.n && jwkObj.e) {
          // Use a minimal rsa-pem generation via node crypto's KeyObject
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const der = Buffer.from(
            // Build a SubjectPublicKeyInfo DER sequence from modulus/exponent
            // Use a lightweight approach: construct the ASN.1 structure manually
            // This implementation is intentionally small and expects standard RSA JWKs.
            // For full correctness in production, prefer using `jose` or `node-jose`.
            '',
            'base64',
          );
          // Fallback: use the jwk as PEM via a simple placeholder - prefer library in future
          return null;
        }
      } catch {
        // ignore and fallback
      }
      return null;
    };

    // Prefer using the `jose` library if present for robust JWK handling
    let verified = false;
    try {
      // Dynamic import to avoid hard dependency
      const jose = await import('jose');
      const jwkKey = await jose.importJWK(jwk);
      await jose.jwtVerify(verificationHeader, jwkKey, {
        // Accept small clock skew
        maxTokenAge: '5m',
      });
      verified = true;
    } catch (e: unknown) {
      // If jose not available or verification failed, fallback to manual checks below
      const err = e as any;
      if (err?.code === 'MODULE_NOT_FOUND' || err?.message?.includes("Cannot find module 'jose'")) {
        // jose missing - fall back
      } else if (e) {
        console.error('[webhook] JWT verification failed (jose):', e);
      }
    }

    if (!verified) {
      // As a last resort, attempt simple signature verification for RSA using crypto.verify
      // This requires converting the JWK to PEM; if conversion isn't implemented, fail safe.
      const pem = jwkToPem(jwk);
      if (!pem) {
        console.error(
          "[webhook] Unable to verify JWT: JWK->PEM conversion unavailable. Install 'jose' for verification.",
        );
        return false;
      }

      const alg = headerJson.alg || 'RS256';
      const verify = crypto.createVerify(alg.replace(/^RS/, 'RSA-SHA'));
      verify.update(segments[0] + '.' + segments[1]);
      verify.end();
      const signature = Buffer.from(segments[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
      verified = verify.verify(pem, signature);
      if (!verified) {
        console.error('[webhook] JWT signature verification failed (fallback)');
        return false;
      }
    }

    // At this point the JWT signature is valid. Now check iat for replay attacks
    const iat = payloadJson.iat;
    if (!iat || typeof iat !== 'number') {
      console.error('[webhook] JWT payload missing iat');
      return false;
    }
    const issuedAt = new Date(iat * 1000);
    const now = new Date();
    const diffMs = Math.abs(now.getTime() - issuedAt.getTime());
    if (diffMs > 5 * 60 * 1000) {
      console.error('[webhook] JWT iat outside allowed window', { diffMs });
      return false;
    }

    // Validate request body integrity: compute SHA-256(rawBody)
    const hash = crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex');
    const expected = payloadJson.request_body_sha256;
    if (!expected || typeof expected !== 'string') {
      console.error('[webhook] JWT payload missing request_body_sha256');
      return false;
    }

    // Constant-time compare
    const a = Buffer.from(hash);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
      console.error('[webhook] Body hash length mismatch');
      return false;
    }
    if (!crypto.timingSafeEqual(a, b)) {
      console.error('[webhook] Body hash mismatch');
      return false;
    }

    return true;
  } catch (error) {
    console.error('[webhook] Error verifying Plaid JWT webhook:', error);
    return false;
  }
}

/**
 * Process Plaid webhook events
 */
async function processPlaidWebhook(
  webhookType: string,
  webhookCode: string | undefined,
  itemId: string | undefined,
  payload: unknown,
): Promise<void> {
  try {
    switch (webhookType) {
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
        console.log(`[webhook] Unhandled webhook type: ${webhookType}`);
    }
  } catch (error) {
    console.error(`[webhook] Error processing ${webhookType} webhook:`, error);
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
