import type { SupabaseClient } from '@supabase/supabase-js';

export interface CursorRecord {
  item_id: string;
  cursor: string | null;
  updated_at?: string;
}

export function cursorsTable(client: SupabaseClient) {
  const table = 'transactions_cursor';

  return {
    async getCursor(itemId: string) {
      const { data, error } = await client
        .from(table)
        .select('cursor')
        .eq('item_id', itemId)
        .single();
      if (error) {
        throw error;
      }
      return (data as any)?.cursor ?? null;
    },

    async setCursor(itemId: string, cursor: string | null) {
      // upsert row
      const { data, error } = await client.from(table).upsert({ item_id: itemId, cursor }).select();
      if (error) {
        throw error;
      }
      return (data as CursorRecord[])?.[0] ?? null;
    },
  };
}
