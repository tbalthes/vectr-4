// src/lib/supabase/transactions.ts
import { type SupabaseClient } from '@supabase/supabase-js';

import { type TransactionWithRelations, type FormattedTransaction } from '@/types/transactions';

/**
 * Formats a raw transaction from the API into a flattened structure for UI components.
 * @param tx - The raw transaction object from the Supabase query.
 * @returns A formatted transaction object.
 */
export const formatTransaction = (tx: TransactionWithRelations): FormattedTransaction => {
  const description = tx.merchants?.name || tx.original_description || 'Unknown';
  const amount = Number(tx.amount);

  return {
    transactionId: tx.transaction_id,
    accountId: tx.accounts?.account_id || '',
    date: tx.date,
    description,
    amount,
    currency: tx.currency,
    pending: tx.pending ?? false,
    merchantName: tx.merchants?.name || null,
    merchantLogoUrl: tx.merchants?.logo_url || tx.logo_url || null,
    categoryName:
      (tx.categories as any)?.name || tx.categories?.category || tx.detailed_category || null,
    categoryIcon: tx.categories?.lucide_icon || tx.categories?.icon || null,
    accountName: tx.accounts?.name || 'Unknown Account',
    accountMask: tx.accounts?.mask || null,
    needsReview: tx.needs_review ?? false,
    isHidden: tx.is_hidden ?? false,
    notes: tx.notes,
    type: amount > 0 ? 'income' : 'expense',
    status: tx.pending ? 'pending' : 'completed',
    originalDescription: tx.original_description || '',
    originalData: tx,
  };
};

/**
 * Fetches transactions with their related account, merchant, and category data.
 * @param supabase - The Supabase client instance.
 * @param userId - The ID of the user to fetch transactions for.
 * @param filters - Optional filters for account IDs, date range, etc.
 * @returns A promise that resolves to an array of formatted transactions.
 */
export const getTransactions = async (
  supabase: SupabaseClient,
  userId: string,
  filters: {
    accountIds?: string[];
    fromDate?: string;
    toDate?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{
  data: FormattedTransaction[];
  meta: { totalItems: number; hasNextPage: boolean };
}> => {
  if (!userId) {
    console.error('User ID is required to fetch transactions.');
    return { data: [], meta: { totalItems: 0, hasNextPage: false } };
  }

  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Query for the total count first (avoid head=true which can be blocked by proxies)
  let countQuery = supabase
    .from('transactions')
    .select('transaction_id', { count: 'exact' })
    .eq('user_id', userId);

  if (filters.accountIds && filters.accountIds.length > 0) {
    countQuery = countQuery.in('account_id', filters.accountIds);
  }
  if (filters.fromDate) {
    countQuery = countQuery.gte('date', filters.fromDate);
  }
  if (filters.toDate) {
    countQuery = countQuery.lte('date', filters.toDate);
  }

  const { count, error: countError } = await countQuery;

  if (countError) {
    console.error('Error fetching transaction count:', countError);
    throw countError;
  }

  const totalItems = count || 0;

  // Now, fetch the actual data with pagination
  let dataQuery = supabase
    .from('transactions')
    .select(
      `
      *,
      accounts (*),
      merchants (*),
      categories!transactions_category_id_fkey (*)
    `,
    )
    .eq('user_id', userId);

  if (filters.accountIds && filters.accountIds.length > 0) {
    dataQuery = dataQuery.in('account_id', filters.accountIds);
  }
  if (filters.fromDate) {
    dataQuery = dataQuery.gte('date', filters.fromDate);
  }
  if (filters.toDate) {
    dataQuery = dataQuery.lte('date', filters.toDate);
  }

  const { data, error } = await dataQuery.order('date', { ascending: false }).range(from, to);

  if (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }

  const formattedData: FormattedTransaction[] = data
    ? data.map((tx) => formatTransaction(tx as unknown as TransactionWithRelations))
    : [];

  // Fallback: if icon is missing but detailed_category exists, map it via categories table
  try {
    const needed = Array.from(
      new Set(
        formattedData
          .filter((f) => !f.categoryIcon && (f.originalData as any)?.detailed_category)
          .map((f) => (f.originalData as any).detailed_category as string),
      ),
    );

    if (needed.length > 0) {
      const { data: catRows, error: catErr } = await supabase
        .from('categories')
        .select('category, icon, lucide_icon')
        .in('category', needed)
        .is('user_id', null);

      if (!catErr && catRows) {
        const iconByCategory = new Map<string, string | null>(
          (
            catRows as { category: string; icon?: string | null; lucide_icon?: string | null }[]
          ).map((r) => [r.category, r.lucide_icon || r.icon || null]),
        );

        for (const f of formattedData) {
          if (!f.categoryIcon) {
            const cat = (f.originalData as any)?.detailed_category as string | undefined;
            if (cat && iconByCategory.has(cat)) {
              f.categoryIcon = iconByCategory.get(cat) || null;
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Category icon fallback lookup failed:', e);
  }
  const hasNextPage = to < totalItems - 1;

  return {
    data: formattedData,
    meta: {
      totalItems,
      hasNextPage,
    },
  };
};
