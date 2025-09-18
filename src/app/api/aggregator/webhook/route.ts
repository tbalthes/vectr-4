import crypto from 'crypto';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { logger } from '@/lib/status_logging/logger';
import { runTransactionsSync } from '@/lib/plaid/sync';
import { verifyPlaidWebhook, isVerificationError } from '@/lib/plaid/verify';
function generateDedupeKey(
  itemId: string | undefined,
  webhookType: string | undefined,
  webhookCode: string | undefined,
  payload: any,
  req: Request,
  rawBody?: string,
): string {
  // Prefer stable identifiers provided by Plaid; avoid Date.now() which breaks dedupe
  const stable =
    (payload && (payload.env_ts || payload.time || payload.request_id)) ||
    req.headers.get('x-request-id') ||
    // Fallback: deterministic hash of the raw body
    crypto
      .createHash('sha256')
      .update(rawBody || '', 'utf8')
      .digest('hex');

  // Compose a base string and hash for a compact, deterministic dedupe key
  const base = `${itemId || ''}|${webhookType || ''}|${webhookCode || ''}|${String(stable)}`;
  return crypto.createHash('sha256').update(base).digest('hex');
}

// POST /api/aggregator/webhook
// Production-ready webhook endpoint for Plaid/MX with verification
export async function POST(req: Request) {
  const provider = (req.headers.get('x-aggregator-provider') || 'plaid').toLowerCase();
  const rawBody = await req.text();

  // Verify webhook signature for security BEFORE parsing payload
  if (provider === 'plaid') {
    // Bypass signature verification in local/test mode
    if (process.env.NODE_ENV === 'development' || process.env.SKIP_PLAID_SIGNATURE === '1') {
      // skip verification
    } else {
      try {
        await verifyPlaidWebhook(Object.fromEntries(req.headers.entries()), rawBody);
        logger.info({ event: 'webhook.verification.success' }, 'Webhook signature verified');
      } catch (error) {
        if (isVerificationError(error)) {
          logger.error(
            { event: 'webhook.verification.failed', code: error.code, message: error.message },
            'Webhook verification failed'
          );
          return NextResponse.json(
            { ok: false, error: 'Webhook verification failed' },
            { status: 401 }
          );
        }
        // Re-throw unexpected errors
        throw error;
      }
    }
  }

  // Parse payload JSON only after verification passes
  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
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
  const dedupeKey = generateDedupeKey(itemId, eventType, webhookCode, payload, req, rawBody);

  // Create client once (used for insert/claim/update)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  // Emit metric: webhook received
  logger.info(
    { event: 'webhook.received', provider, eventType, webhookCode, dedupeKey },
    'Webhook received',
  );
  // Atomic gate: attempt to insert first-seen event (unique index on dedupe_key)
  // If another request inserted first, we'll handle the conflict below
  let insertedEventId: string | undefined;
  let currentStatus: string | undefined;
  try {
    const { data: inserted, error } = await supabase
      .from('webhook_events')
      .insert({
        provider: provider,
        event_type: eventType || 'unknown',
        webhook_type: eventType,
        webhook_code: webhookCode,
        item_id: itemId,
        dedupe_key: dedupeKey,
        payload_json: payload,
        status: 'received',
        received_at: new Date().toISOString(),
      })
      .select('id, status')
      .maybeSingle();

    if (error) {
      // Emit metric: insert error
      logger.error(
        { event: 'webhook.insert.error', error, dedupeKey },
        'Insert error storing webhook_event',
      );
      // Unique violation -> someone else inserted the row
      const code = (error as any).code || '';
      const msg = (error as any).message || '';
      const details = (error as any).details || '';
      if (
        code === '23505' ||
        /duplicate key|ux_webhook_events_dedupe_key|already exists/i.test(msg + ' ' + details)
      ) {
        // Fetch current row to decide next step
        const { data: existing } = await supabase
          .from('webhook_events')
          .select('id, status')
          .eq('dedupe_key', dedupeKey)
          .single();
        insertedEventId = existing?.id;
        currentStatus = existing?.status;
      } else {
        logger.error(
          { event: 'webhook.storage.failed', error, dedupeKey },
          'Failed to store event',
        );
      }
    } else {
      insertedEventId = inserted?.id;
      currentStatus = inserted?.status;
    }
  } catch (storageError) {
    logger.error(
      { event: 'webhook.storage.unexpected_error', error: storageError, dedupeKey },
      'Unexpected storage error',
    );
    // Don't fail the webhook for storage issues
  }

  // Try to claim processing by transitioning from 'received' -> 'processing'
  // Only the claimer proceeds to trigger sync; others ack
  let claimed = false;
  try {
    const { data: claimRow } = await supabase
      .from('webhook_events')
      .update({
        status: 'processing',
        processing_claimed_at: new Date().toISOString(),
        processed_by: req.headers.get('x-request-id') || 'webhook-handler',
      })
      .eq('dedupe_key', dedupeKey)
      .eq('status', 'received')
      .select('id, status')
      .maybeSingle();
    claimed = !!claimRow;
    if (claimRow) {
      insertedEventId = claimRow.id;
      currentStatus = claimRow.status;
    } else {
      // If not claimed, fetch status to decide early return
      if (!currentStatus) {
        const { data: existing2 } = await supabase
          .from('webhook_events')
          .select('id, status')
          .eq('dedupe_key', dedupeKey)
          .single();
        insertedEventId = existing2?.id;
        currentStatus = existing2?.status;
      }
    }
  } catch (claimErr) {
    logger.error(
      { event: 'webhook.claim.failed', dedupeKey, error: claimErr },
      'Claim attempt failed',
    );
  }

  if (!claimed) {
    // Emit metric: duplicate or already claimed
    logger.info(
      { event: 'webhook.duplicate', dedupeKey, status: currentStatus },
      'Duplicate or already claimed',
    );
    // Another worker is processing or it's already processed
    // Try to reclaim if stuck in processing beyond threshold
    if (currentStatus === 'processing') {
      const staleMinutes = parseInt(process.env.WEBHOOK_CLAIM_STALE_MINUTES || '15', 10);
      const thresholdIso = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
      try {
        const { data: staleClaim } = await supabase
          .from('webhook_events')
          .update({
            processing_claimed_at: new Date().toISOString(),
            processed_by: req.headers.get('x-request-id') || 'webhook-handler',
          })
          .eq('dedupe_key', dedupeKey)
          .eq('status', 'processing')
          .lt('processing_claimed_at', thresholdIso)
          .select('id, status')
          .maybeSingle();
        if (staleClaim) {
          claimed = true;
          insertedEventId = staleClaim.id;
          currentStatus = staleClaim.status;
        }
      } catch {
        logger.warn(
          { event: 'webhook.claim.reclaim_failed', dedupeKey },
          'Stale claim reclaim attempt failed',
        );
      }
    }
  }

  if (!claimed) {
    // Another worker is processing or it's already processed
    return NextResponse.json({
      ok: true,
      dedupeKey,
      status: currentStatus || 'unknown',
      message: 'Duplicate or already claimed; no action taken',
    });
  }

  // Process specific webhook types
  try {
    // Emit metric: claim success
    logger.info({ event: 'webhook.claim.success', dedupeKey }, 'Claim success');
    if (provider === 'plaid' && eventType) {
      await processPlaidWebhook(eventType, webhookCode, itemId, payload, dedupeKey);
    }
    // Mark as processed on success
    if (insertedEventId) {
      // Emit metric: processed
      logger.info({ event: 'webhook.processed', dedupeKey }, 'Processed webhook successfully');
      await supabase
        .from('webhook_events')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
          processed_by: req.headers.get('x-request-id') || 'webhook-handler',
        })
        .eq('id', insertedEventId);
    }
  } catch (procErr) {
    logger.error(
      { event: 'webhook.processing.failed', dedupeKey, error: (procErr as any)?.message },
      'Processing failed',
    );
    logger.info(
      { event: 'webhook.processing.error_row', dedupeKey },
      'Processing error; updating error row',
    );

    if (insertedEventId) {
      const errMessage =
        (procErr as any)?.message?.toString().slice(0, 1000) || 'processing error (redacted)';
      // Safely increment retry_count
      let newRetryCount = 1;
      try {
        const { data: retryRow } = await supabase
          .from('webhook_events')
          .select('retry_count')
          .eq('id', insertedEventId)
          .single();
        newRetryCount = ((retryRow?.retry_count as number) || 0) + 1;
      } catch {
        // Minimal log only; do not include sensitive data
        logger.warn(
          { event: 'webhook.retry_count.read_failed', dedupeKey },
          'Failed to read current retry_count',
        );
      }

      await supabase
        .from('webhook_events')
        .update({
          status: 'error',
          last_error: errMessage,
          retry_count: newRetryCount,
        })
        .eq('id', insertedEventId);

      logger.info(
        {
          event: 'webhook.error_row.updated',
          dedupeKey,
          retry_count: newRetryCount,
          last_error: errMessage,
        },
        'Error row updated',
      );
    }
    // Always ACK with 2xx to prevent provider retries; monitoring should alert
    return NextResponse.json(
      {
        ok: true,
        dedupeKey,
        message: 'Processing failed; marked as error',
      },
      { status: 200 },
    );
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
 * Generate deterministic dedupe key for webhook events
 */
async function processPlaidWebhook(
  eventType: string,
  webhookCode: string | undefined,
  itemId: string | undefined,
  payload: unknown,
  dedupeKey?: string,
): Promise<void> {
  if (webhookCode === 'FORCE_ERROR') {
    throw new Error('Simulated processing failure for test');
  }

  try {
    switch (eventType) {
      case 'TRANSACTIONS':
        await handleTransactionsWebhook(webhookCode, itemId, payload, dedupeKey);
        break;

      case 'ITEM':
        await handleItemWebhook(webhookCode, itemId, payload);
        break;

      case 'ERROR':
        await handleErrorWebhook(webhookCode, itemId, payload);
        break;

      default:
        logger.info(
          { event: 'webhook.unhandled_event_type', eventType, dedupeKey },
          'Unhandled event type',
        );
    }
  } catch (error) {
    logger.error(
      { event: 'webhook.processing_error', eventType, error, dedupeKey },
      'Error processing webhook',
    );
  }
}

/**
 * Handle transaction-related webhooks
 */
// Replace existing handleTransactionsWebhook with this
async function handleTransactionsWebhook(
  webhookCode: string | undefined,
  itemId: string | undefined,
  payload: unknown,
  dedupeKey?: string,
): Promise<void> {
  switch (webhookCode) {
    case 'INITIAL_UPDATE':
      logger.info(
        {
          event: 'webhook.transactions.initial_update',
          dedupeKey,
          itemId,
          webhookCode,
          skipped: true,
          reason: 'sync_trigger_reduction_mvp',
        },
        'Initial transaction update received - skipping automatic sync by default',
      );
      // Optional: Enable this trigger if needed for initial account setup
      // await triggerTransactionSync(itemId, 'initial');
      break;

    case 'HISTORICAL_UPDATE':
      logger.info(
        {
          event: 'webhook.transactions.historical_update',
          dedupeKey,
          itemId,
          webhookCode,
          skipped: true,
          reason: 'sync_trigger_reduction_mvp',
        },
        'Historical transaction update received - skipping automatic sync',
      );
      break;

    case 'DEFAULT_UPDATE':
      logger.info(
        {
          event: 'webhook.transactions.default_update',
          dedupeKey,
          itemId,
          webhookCode,
          skipped: true,
          reason: 'sync_trigger_reduction_mvp',
        },
        'Default transaction update received - skipping automatic sync',
      );
      break;

    case 'TRANSACTIONS_REMOVED': {
      const removedTxs =
        ((payload as Record<string, unknown>)?.removed_transactions as string[]) || [];
      logger.info(
        {
          event: 'webhook.transactions.removed',
          dedupeKey,
          itemId,
          webhookCode,
          removedCount: removedTxs.length,
          skipped: true,
          reason: 'sync_trigger_reduction_mvp',
          note: 'Removals handled via next /transactions/sync removed[]',
        },
        'Transactions removed - skipping explicit sync',
      );
      break;
    }

    case 'SYNC_UPDATES_AVAILABLE': {
      logger.info(
        {
          event: 'webhook.transactions.sync_updates_available',
          dedupeKey,
          itemId,
          webhookCode,
          triggered: true,
        },
        'Sync updates available - triggering sync',
      );
      await triggerTransactionSyncOnce(itemId);
      break;
    }

    default:
      logger.info(
        {
          event: 'webhook.transactions.unhandled',
          dedupeKey,
          itemId,
          webhookCode,
        },
        'Unhandled transactions webhook - no action taken',
      );
  }
}

/**
 * Trigger transaction sync for an item
 */
async function triggerTransactionSyncOnce(itemId: string | undefined): Promise<void> {
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
      logger.warn(
        { event: 'webhook.sync.no_account_link', itemId, syncType: 'sync' },
        'No active account link found',
      );
      return;
    }

    logger.info(
      { event: 'webhook.sync.triggered', itemId, syncType: 'sync' },
      'Triggering transaction sync',
    );
    // Preferred: call orchestrator directly (single call; no external loops)
    try {
      const summary = await runTransactionsSync({
        client: supabase,
        access_token: accountLink.access_token_encrypted,
        user_id: accountLink.user_id,
        item_id: itemId,
        start_cursor: accountLink.cursor || null,
        pageSize: 100,
      });
      logger.info(
        { event: 'webhook.sync.completed', itemId, syncType: 'sync', summary },
        'Sync completed successfully',
      );
    } catch (e: any) {
      logger.error(
        { event: 'webhook.sync.failed', itemId, syncType: 'sync', error: e?.message },
        'Sync failed',
      );
    }
  } catch (error) {
    logger.error(
      { event: 'webhook.sync.error', itemId, syncType: 'sync', error },
      'Error triggering sync',
    );
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
      logger.warn(
        { event: 'webhook.item.error', itemId, webhookCode, payload },
        'Item error received',
      );
      // TODO: Mark item as requiring user attention
      break;

    case 'PENDING_EXPIRATION':
      logger.warn(
        { event: 'webhook.item.pending_expiration', itemId, webhookCode },
        'Item access will expire soon',
      );
      // TODO: Notify user to re-authenticate
      break;

    default:
      logger.info(
        { event: 'webhook.item.unhandled', itemId, webhookCode },
        'Unhandled item webhook',
      );
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
  logger.error({ event: 'webhook.error', itemId, webhookCode, payload }, 'Error webhook received');
  // TODO: Handle specific error types and notify users
  return Promise.resolve();
}
