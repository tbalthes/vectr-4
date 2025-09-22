import { useState, useEffect, useCallback } from 'react';
import { type User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/supabase';
import { getTransactions } from '@/lib/supabase/transactions';
import { type FormattedTransaction } from '@/types/transactions';

export interface InfiniteTransactionsFilters {
  accountIds?: string[];
  fromDate?: string;
  toDate?: string;
  pageSize?: number;
}

export interface DateHeader {
  type: 'date-header';
  date: string;
  // Optional UI fields used by consumers
  id?: string;
  displayDate?: string;
  dailyTotal?: number;
}

export interface TransactionItem {
  type: 'transaction';
  data: FormattedTransaction;
}

export type GroupedTransactionItem = DateHeader | TransactionItem;

export interface InfiniteTransactionsResult {
  transactions: GroupedTransactionItem[];
  isLoading: boolean;
  isReachingEnd: boolean;
  loadMore: () => void;
  error: Error | null;
  size: number;
  setSize: (size: number | ((_size: number) => number)) => void;
  meta: {
    totalItems: number;
    currentPage: number;
    pageSize: number;
  };
  updateTransactionOptimistic: (
    transactionId: string,
    updatedFields: Partial<FormattedTransaction>,
  ) => void;
  revalidate: () => Promise<void>;
}

export function useInfiniteTransactions(
  filters: InfiniteTransactionsFilters = {},
): InfiniteTransactionsResult {
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<FormattedTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ totalItems: 0, hasNextPage: true });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const pageSize = filters.pageSize || 50;

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setIsLoading(false);
    };
    void getUser();
  }, []);

  const loadTransactions = useCallback(
    async (currentPage: number, initialLoad = false) => {
      if (!user) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, meta: newMeta } = await getTransactions(supabase, user.id, {
          ...filters,
          page: currentPage,
          pageSize,
        });

        setTransactions((prev) => (initialLoad ? data : [...prev, ...data]));
        setMeta(newMeta);
      } catch (e) {
        setError(e as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [user, filters, pageSize],
  );

  useEffect(() => {
    if (user) {
      void loadTransactions(1, true);
    }
  }, [user, loadTransactions]);

  const loadMore = useCallback(() => {
    if (!isLoading && meta.hasNextPage) {
      const nextPage = page + 1;
      setPage(nextPage);
      void loadTransactions(nextPage);
    }
  }, [isLoading, meta.hasNextPage, page, loadTransactions]);

  const revalidate = useCallback(async () => {
    if (user) {
      await loadTransactions(1, true);
    }
  }, [user, loadTransactions]);

  const updateTransactionOptimistic = useCallback(
    (transactionId: string, updatedFields: Partial<FormattedTransaction>) => {
      setTransactions((prev) =>
        prev.map((t) => (t.transactionId === transactionId ? { ...t, ...updatedFields } : t)),
      );
    },
    [],
  );

  const groupedTransactions = transactions.reduce((acc: GroupedTransactionItem[], tx) => {
    const date = tx.date.split('T')[0];
    const lastItem = acc[acc.length - 1];

    const lastDate =
      lastItem && lastItem.type === 'date-header'
        ? lastItem.date
        : lastItem && lastItem.type === 'transaction'
          ? lastItem.data.date.split('T')[0]
          : undefined;

    if (!lastItem || lastDate !== date) {
      acc.push({ type: 'date-header', date });
    }

    acc.push({ type: 'transaction', data: tx });
    return acc;
  }, [] as GroupedTransactionItem[]);

  return {
    transactions: groupedTransactions,
    isLoading,
    isReachingEnd: !meta.hasNextPage,
    loadMore,
    error,
    size: page,
    setSize: (p: number | ((_size: number) => number)) => {
      const newPage = typeof p === 'function' ? p(page) : p;
      setPage(newPage);
      void loadTransactions(newPage, true);
    },
    meta: { totalItems: meta.totalItems, currentPage: page, pageSize },
    updateTransactionOptimistic,
    revalidate,
  };
}
