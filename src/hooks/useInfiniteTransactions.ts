import useSWRInfinite from 'swr/infinite';
import qs from 'query-string';
import { useCallback } from 'react';
import { FormattedTransaction } from '@/types/transactions';

export interface InfiniteTransactionsFilters {
  q?: string;
  sortBy?: 'date' | 'amount' | 'transaction_number';
  sortOrder?: 'asc' | 'desc';
  pageSize?: number;
}

export type DateHeader = {
  type: 'date-header';
  date: string;
  displayDate: string;
  id: string; // Required for virtuoso key
  dailyTotal: number; // Total amount for the day
};

export type TransactionItem = FormattedTransaction | DateHeader;

export type InfiniteTransactionsResult = {
  transactions: TransactionItem[];
  isLoadingMore: boolean;
  isReachingEnd: boolean;
  loadMore: () => void;
  error: unknown;
  size: number;
  setSize: (size: number | ((_size: number) => number)) => void;
  meta?: {
    totalItems: number;
    currentPage: number;
    pageSize: number;
    hasNextPage: boolean;
  };
};

type ApiResponse = {
  data: FormattedTransaction[];
  meta: {
    totalItems: number;
    currentPage: number;
    pageSize: number;
    hasNextPage: boolean;
  };
};

const fetcher = (url: string): Promise<ApiResponse> => fetch(url).then(res => res.json());

/**
 * useInfiniteTransactions - Infinite loading hook for paginated transaction API.
 * @param filters - Filtering and sorting options
 * @returns InfiniteTransactionsResult
 */
export function useInfiniteTransactions(filters: InfiniteTransactionsFilters = {}): InfiniteTransactionsResult {
  const pageSize = filters.pageSize || 25;

  const getKey = (pageIndex: number, previousPageData?: ApiResponse) => {
    if (previousPageData && !previousPageData.meta?.hasNextPage) return null;
    const params = {
      ...filters,
      page: pageIndex + 1,
      limit: pageSize,
    };
    return `/api/transactions?${qs.stringify(params)}`;
  };

  const {
    data,
    error,
    size,
    setSize,
    isValidating,
  } = useSWRInfinite(getKey, fetcher, {
    revalidateFirstPage: false,
  });

  // Flatten all loaded pages and remove duplicates by transaction ID
  const flatTransactions: FormattedTransaction[] = Array.from(
    new Map(
      data?.flatMap((page) => page?.data || []).map(transaction => [transaction.id, transaction]) || []
    ).values()
  );

  // Group transactions by date for sticky headers
  const groupedTransactions = flatTransactions.reduce((groups, transaction) => {
    const date = new Date(transaction.date).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {} as Record<string, FormattedTransaction[]>);

  // Create a flat array with date headers and transactions
  const transactions: TransactionItem[] = [];
  
  Object.entries(groupedTransactions)
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime()) // Sort dates descending
    .forEach(([dateString, dateTransactions]) => {
      const date = new Date(dateString);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let displayDate: string;
      if (date.toDateString() === today.toDateString()) {
        displayDate = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        displayDate = 'Yesterday';
      } else {
        displayDate = date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      
      // Calculate daily total
      const dailyTotal = dateTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
      
      // Add date header
      transactions.push({
        type: 'date-header',
        date: dateString,
        displayDate,
        id: `date-header-${dateString}`,
        dailyTotal
      });
      
      // Add transactions for this date (sorted by time, newest first)
      const sortedTransactions = dateTransactions.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      transactions.push(...sortedTransactions);
    });
  const meta = data?.[data.length - 1]?.meta || data?.[0]?.meta;
  const isLoadingMore = isValidating && size > 0;
  const isReachingEnd = meta ? !meta.hasNextPage : false;

  const loadMore = useCallback(() => {
    console.log('useInfiniteTransactions loadMore called:', {
      isReachingEnd,
      currentSize: size,
      hasMeta: !!meta,
      meta: meta
    });
    if (!isReachingEnd) {
      console.log('useInfiniteTransactions: Increasing size from', size, 'to', size + 1);
      setSize(size + 1);
    } else {
      console.log('useInfiniteTransactions: Not loading more - reached end');
    }
  }, [isReachingEnd, setSize, size, meta]);

  return {
    transactions,
    isLoadingMore,
    isReachingEnd,
    loadMore,
    error,
    size,
    setSize,
    meta,
  };
}
