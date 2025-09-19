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

  logger.info(
    { event: 'sync.start', item_id, user_id, has_cursor: !!start_cursor, count: pageSize },
    'Starting Plaid /transactions/sync',
  );

  let nextCursor = start_cursor ?? null;
  let totalAdded = 0;
  let totalModified = 0;
  let totalRemoved = 0;

  while (true) {
    let page;
    try {
      page = await transactionsSync({ access_token, cursor: nextCursor, count: pageSize });
    } catch (e: any) {
      const msg = String(e?.message || e);
      logger.error(
        { 
          event: 'sync.fetch_error', 
          item_id, 
          user_id, 
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
      break;
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
