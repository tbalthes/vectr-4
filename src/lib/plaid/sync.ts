// Service-layer orchestrator for Plaid transaction sync

import type { SupabaseClient } from '@supabase/supabase-js';

import type { PlaidEvent, SyncSummary } from './types';
import { transactionsSync } from './client';
import { upsertAddedAndModified, markRemoved } from './transactions';

import { logger } from '@/lib/status_logging/logger';
import { cursorsTable } from '@/lib/db/cursors';

interface RunSyncParams {
  client: SupabaseClient;
  access_token: string;
  user_id: string;
  item_id: string;
  start_cursor?: string | null;
  pageSize?: number;
}

export async function runTransactionsSync(params: RunSyncParams): Promise<SyncSummary> {
  const { client, access_token, user_id, item_id, start_cursor, pageSize = 100 } = params;
  const startedAt = Date.now();

  // Safeguards to prevent runaway loops
  const MAX_PAGES = parseInt(process.env.PLAID_SYNC_MAX_PAGES || '50', 10);
  const MAX_DURATION_MS = parseInt(process.env.PLAID_SYNC_MAX_DURATION_MS || '300000', 10); // 5 minutes
  const RATE_LIMIT_DELAY_MS = parseInt(process.env.PLAID_SYNC_RATE_DELAY_MS || '100', 10);

  logger.info(
    { 
      event: 'sync.start', 
      item_id, 
      user_id, 
      has_cursor: !!start_cursor, 
      count: pageSize,
      max_pages: MAX_PAGES,
      max_duration_ms: MAX_DURATION_MS
    },
    'Starting Plaid /transactions/sync with safeguards',
  );

  let nextCursor = start_cursor ?? null;
  let totalAdded = 0;
  let totalModified = 0;
  let totalRemoved = 0;
  let pageCount = 0;

  while (true) {
    // Safeguard 1: Check maximum pages processed
    if (pageCount >= MAX_PAGES) {
      logger.warn(
        {
          event: 'sync.max_pages_reached',
          item_id,
          user_id,
          pages_processed: pageCount,
          max_pages: MAX_PAGES,
        },
        'Maximum pages limit reached - stopping sync',
      );
      break;
    }

    // Safeguard 2: Check maximum duration
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs > MAX_DURATION_MS) {
      logger.warn(
        {
          event: 'sync.max_duration_reached',
          item_id,
          user_id,
          elapsed_ms: elapsedMs,
          max_duration_ms: MAX_DURATION_MS,
        },
        'Maximum duration limit reached - stopping sync',
      );
      break;
    }

    let page;
    try {
      page = await transactionsSync({ access_token, cursor: nextCursor, count: pageSize });
      pageCount++;
    } catch (e: any) {
      const msg = String(e?.message || e);
      logger.error(
        { 
          event: 'sync.fetch_error', 
          item_id, 
          user_id, 
          page_count: pageCount,
          error: { 
            message: msg,
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            code: e && typeof e === 'object' && 'code' in e ? (e as any).code : undefined,
            stack: e instanceof Error ? e.stack : undefined
          } 
        },
        'Error fetching sync page',
      );
      throw e;
    }

    logger.info(
      {
        event: 'sync.page',
        item_id,
        page_number: pageCount,
        added: page.added?.length || 0,
        modified: page.modified?.length || 0,
        removed: page.removed?.length || 0,
        has_more: page.has_more,
      },
      'Sync page received',
    );

    await upsertAddedAndModified(client, user_id, page.added || [], page.modified || []);
    const removedIds = (page.removed || []).map((r) => r.transaction_id);
    await markRemoved(client, user_id, removedIds);

    totalAdded += page.added?.length || 0;
    totalModified += page.modified?.length || 0;
    totalRemoved += page.removed?.length || 0;
    nextCursor = page.next_cursor ?? nextCursor;

    if (!page.has_more) {
      logger.info(
        {
          event: 'sync.natural_completion',
          item_id,
          pages_processed: pageCount,
        },
        'Sync completed naturally (has_more = false)',
      );
      break;
    }

    // Safeguard 3: Rate limiting between requests
    if (RATE_LIMIT_DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
    }
  }

  if (item_id && nextCursor) {
    try {
      const repo = cursorsTable(client);
      await repo.setCursor(item_id, nextCursor);
      logger.info(
        { event: 'sync.cursor_updated', item_id, final_cursor: nextCursor },
        'Cursor updated',
      );
    } catch (cErr: any) {
      logger.error(
        {
          event: 'sync.cursor_update_failed',
          item_id,
          final_cursor: nextCursor,
          error: cErr ? { 
            message: cErr.message,
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            code: cErr && typeof cErr === 'object' && 'code' in cErr ? (cErr as any).code : undefined,
            stack: cErr instanceof Error ? cErr.stack : undefined
          } : undefined,
        },
        'Failed to persist cursor',
      );
    }
  }

  const duration_ms = Date.now() - startedAt;
  const summary: SyncSummary = {
    ok: true,
    item_id,
    user_id,
    added_count: totalAdded,
    modified_count: totalModified,
    removed_count: totalRemoved,
    final_cursor: nextCursor ?? null,
    duration_ms,
  };

  logger.info({ event: 'sync.completed', ...summary }, 'Plaid sync completed');
  return summary;
}

// Minimal placeholders retained for future queue-based orchestration
export function enqueueSync(itemId: string, _reason = 'webhook') {
  return { ok: true, jobId: `${itemId}:${Date.now()}` };
}

export function processSyncJob(_jobId: string) {
  return { ok: true };
}

export function handlePlaidEvent(event: PlaidEvent) {
  if (event.webhook_code === 'SYNC_UPDATES_AVAILABLE') {
    return enqueueSync(event.item_id || 'unknown', 'sync_updates_available');
  }
  return { ok: true };
}
