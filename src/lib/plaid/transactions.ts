import type { SupabaseClient } from '@supabase/supabase-js';

import type { PlaidEvent, PlaidTransaction } from './types';

import { logger } from '@/lib/status_logging/logger';
import { transactionsTable } from '@/lib/db/transactions';

// Map Plaid transaction to our app row shape (adjust fields to your schema)
export function toAppRow(user_id: string, t: PlaidTransaction) {
  return {
    user_id,
    aggregator_transaction_id: t.transaction_id,
    account_id: t.account_id,
    name: t.merchant_name || t.name || null,
    amount: t.amount, // convert to cents here if your schema stores cents
    iso_currency_code: t.iso_currency_code || null,
    date: t.date,
    raw: t,
    removed: false,
    updated_at: new Date().toISOString(),
  } as any;
}

export async function upsertAddedAndModified(
  client: SupabaseClient,
  user_id: string,
  added: PlaidTransaction[],
  modified: PlaidTransaction[],
) {
  const repo = transactionsTable(client);
  const rows = [
    ...(added || []).map((t) => toAppRow(user_id, t)),
    ...(modified || []).map((t) => toAppRow(user_id, t)),
  ];
  if (rows.length === 0) {
    return;
  }

  try {
    await repo.bulkUpsert(rows, 500);
  } catch (err: any) {
    logger.error(
      { event: 'sync.upsert_failed', count: rows.length, error: err?.message },
      'Upsert failed',
    );
  }
}

export async function markRemoved(client: SupabaseClient, user_id: string, removedIds: string[]) {
  if (!removedIds || removedIds.length === 0) {
    return;
  }
  const repo = transactionsTable(client);
  try {
    await repo.markRemovedByAggregatorIds(user_id, removedIds);
  } catch (err: any) {
    logger.error(
      { event: 'sync.remove_failed', count: removedIds.length, error: err?.message },
      'Removal mark failed',
    );
  }
}

export async function triggerTransactionSync(params: {
  access_token: string;
  cursor?: string | null;
  user_id: string;
  item_id?: string;
  count?: number;
}) {
  const { access_token, cursor, user_id, item_id, count = 100 } = params;
  logger.info(
    { event: 'webhook.sync.triggered', itemId: item_id, syncType: 'sync' },
    'Triggering transaction sync',
  );

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/aggregator/plaid/transactions/sync`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token, cursor: cursor || undefined, count, user_id, item_id }),
    },
  );

  const text = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text?.slice(0, 2000) };
  }

  if (!res.ok) {
    logger.error(
      { event: 'webhook.sync.failed', status: res.status, body: parsed },
      'Sync call failed',
    );
    return { ok: false as const, status: res.status, body: parsed };
  }

  logger.info(
    { event: 'webhook.sync.completed', itemId: item_id, syncType: 'sync' },
    'Sync completed successfully',
  );
  return { ok: true as const, body: parsed };
}

export function handlePlaidTransactionEvent(_event: PlaidEvent) {
  // placeholder: enqueue or process event
  return { ok: true };
}
