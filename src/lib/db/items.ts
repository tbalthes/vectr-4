import type { SupabaseClient } from '@supabase/supabase-js';

export interface ItemRecord {
  id: string;
  user_id: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, any>;
}

export function itemsTable(client: SupabaseClient) {
  const table = 'items';

  return {
    async getById(id: string) {
      const { data, error } = await client.from(table).select('*').eq('id', id).single();
      if (error) {
        throw error;
      }
      return data as ItemRecord | null;
    },

    async listByUser(userId: string) {
      const { data, error } = await client.from(table).select('*').eq('user_id', userId);
      if (error) {
        throw error;
      }
      return (data as ItemRecord[]) ?? [];
    },

    async upsert(item: Partial<ItemRecord>) {
      const { data, error } = await client.from(table).upsert(item).select();
      if (error) {
        throw error;
      }
      return data as ItemRecord[];
    },

    async updateStatus(id: string, patch: Partial<ItemRecord>) {
      const { data, error } = await client.from(table).update(patch).eq('id', id).select();
      if (error) {
        throw error;
      }
      return (data as ItemRecord[])?.[0] ?? null;
    },
  };
}
