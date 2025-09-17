import type { SupabaseClient } from '@supabase/supabase-js';

export interface TransactionRecord {
  id: string;
  user_id: string;
  account_id: string;
  amount_cents: number;
  date: string; // ISO date
  aggregator_transaction_id?: string; // stable dedupe key
  raw_payload?: Record<string, any>;
  created_at?: string;
}

export function transactionsTable(client: SupabaseClient) {
  const table = 'transactions';

  return {
    async getByAggregatorId(aggregatorId: string) {
      const { data, error } = await client
        .from(table)
        .select('*')
        .eq('aggregator_transaction_id', aggregatorId)
        .single();
      if (error) {
        throw error;
      }
      return data as TransactionRecord | null;
    },

    async bulkUpsert(rows: Partial<TransactionRecord>[], batchSize = 500) {
      // Placeholder: split into batches and upsert with ON CONFLICT on aggregator_transaction_id.
      // Supabase's upsert delegates to Postgres ON CONFLICT; ensure unique constraint exists at DB level.
      const results: TransactionRecord[] = [];
      for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize);
        const { data, error } = await client
          .from(table)
          .upsert(chunk, { onConflict: 'user_id,aggregator_transaction_id' })
          .select();
        if (error) {
          throw error;
        }
        results.push(...((data as TransactionRecord[]) ?? []));
      }
      return results;
    },

    async markRemovedByAggregatorIds(user_id: string, aggregatorIds: string[]) {
      // soft-delete or mark removed
      const { data, error } = await client
        .from(table)
        .update({
          /* is_removed: true */
        })
        .in('aggregator_transaction_id', aggregatorIds)
        .eq('user_id', user_id)
        .select();
      if (error) {
        throw error;
      }
      return data as TransactionRecord[];
    },
  };
}

export function normalizeTransactionFromPlaid(plaidTx: any): Partial<TransactionRecord> {
  // map fields: amount -> amount_cents, date normalization, aggregator key
  return {
    amount_cents: Math.round((plaidTx.amount ?? 0) * 100),
    date: plaidTx.date,
    aggregator_transaction_id: plaidTx.transaction_id || undefined,
    raw_payload: plaidTx,
  };
}
