import type { SupabaseClient } from '@supabase/supabase-js';

export interface AccountRecord {
  id: string;
  item_id: string;
  mask?: string | null;
  name?: string | null;
  subtype?: string | null;
  created_at?: string;
}

export function accountsTable(client: SupabaseClient) {
  const table = 'accounts';

  return {
    async getById(id: string) {
      const { data, error } = await client.from(table).select('*').eq('id', id).single();
      if (error) {
        throw error;
      }
      return data as AccountRecord | null;
    },

    async listByItem(itemId: string) {
      const { data, error } = await client.from(table).select('*').eq('item_id', itemId);
      if (error) {
        throw error;
      }
      return (data as AccountRecord[]) ?? [];
    },

    async upsertMany(rows: Partial<AccountRecord>[]) {
      const { data, error } = await client.from(table).upsert(rows).select();
      if (error) {
        throw error;
      }
      return data as AccountRecord[];
    },
  };
}
