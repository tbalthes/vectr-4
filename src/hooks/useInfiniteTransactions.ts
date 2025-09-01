import useSWRInfinite from "swr/infinite";
import qs from "query-string";
import { useCallback } from "react";
import { FormattedTransaction } from "@/types/transactions";

export interface InfiniteTransactionsFilters {
  q?: string;
  sortBy?: "date" | "amount" | "transaction_number";
  sortOrder?: "asc" | "desc";
  pageSize?: number;
  // Date range filters
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
  // Category filter
  category?: string;
  // Amount filters
  amountMin?: number;
  amountMax?: number;
  amountType?: "income" | "expense" | "all";
  // Status filters
  needsReview?: boolean;
  hasManualEdit?: boolean;
}

export type DateHeader = {
  type: "date-header";
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
  // Optimistic update helpers
  updateTransactionOptimistic?: (updated: Record<string, unknown>) => void;
  revalidate?: () => Promise<unknown>;
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

const fetcher = (url: string): Promise<ApiResponse> =>
  fetch(url).then((res) => res.json());

/**
 * useInfiniteTransactions - Infinite loading hook for paginated transaction API.
 * @param filters - Filtering and sorting options
 * @returns InfiniteTransactionsResult
 */
export function useInfiniteTransactions(
  filters: InfiniteTransactionsFilters = {}
): InfiniteTransactionsResult {
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

  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite(
    getKey,
    fetcher,
    {
      revalidateFirstPage: false,
    }
  );

  // Flatten all loaded pages and remove duplicates by transaction ID
  const flatTransactions: FormattedTransaction[] = Array.from(
    new Map(
      data
        ?.flatMap((page) => page?.data || [])
        .map((transaction) => [transaction.id, transaction]) || []
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
        displayDate = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        displayDate = "Yesterday";
      } else {
        displayDate = date.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }

      // Calculate daily total
      const dailyTotal = dateTransactions.reduce(
        (sum, transaction) => sum + transaction.amount,
        0
      );

      // Add date header
      transactions.push({
        type: "date-header",
        date: dateString,
        displayDate,
        id: `date-header-${dateString}`,
        dailyTotal,
      });

      // Add transactions for this date (sorted by time, newest first)
      const sortedTransactions = dateTransactions.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      transactions.push(...sortedTransactions);
    });
  const meta = data?.[data.length - 1]?.meta || data?.[0]?.meta;
  const isLoadingMore = isValidating && size > 0;
  const isReachingEnd = meta ? !meta.hasNextPage : false;

  const loadMore = useCallback(() => {
    console.log("useInfiniteTransactions loadMore called:", {
      isReachingEnd,
      currentSize: size,
      hasMeta: !!meta,
      meta: meta,
    });
    if (!isReachingEnd) {
      console.log(
        "useInfiniteTransactions: Increasing size from",
        size,
        "to",
        size + 1
      );
      setSize(size + 1);
    } else {
      console.log("useInfiniteTransactions: Not loading more - reached end");
    }
  }, [isReachingEnd, setSize, size, meta]);

  // Helper to convert snake_case keys from the detailed transaction into the flattened UI keys
  const mapUpdatedFields = useCallback((updated: Record<string, unknown>) => {
    const mapped: Record<string, unknown> = {};
    if (updated.merchant_name !== undefined)
      mapped.merchantName = updated.merchant_name;
    if (updated.merchant_logo_url !== undefined)
      mapped.merchantLogoUrl = updated.merchant_logo_url;
    if (updated.category_name !== undefined)
      mapped.categoryName = updated.category_name;
    if (updated.category_icon !== undefined)
      mapped.categoryIcon = updated.category_icon;
    if (updated.transaction_note !== undefined)
      mapped.note = updated.transaction_note;
    if (updated.original_description !== undefined)
      mapped.originalDescription = updated.original_description;
    if (updated.amount !== undefined) mapped.amount = updated.amount;
    if (updated.balance !== undefined) mapped.balance = updated.balance;
    if (updated.date !== undefined) mapped.date = updated.date;
    if (updated.transaction_number !== undefined)
      mapped.transaction_number = updated.transaction_number;
    return mapped as Partial<FormattedTransaction>;
  }, []);

  // Optimistic update helper: merge partial updated fields into the cached pages
  const updateTransactionOptimistic = useCallback(
    (updated: Record<string, unknown>) => {
      if (!mutate) return;
      mutate((pages: ApiResponse[] | undefined) => {
        if (!pages) return pages;
        const mapped = mapUpdatedFields(updated);
        return pages.map((page) => {
          if (!page || !Array.isArray(page.data)) return page;
          return {
            ...page,
            data: page.data.map((t) =>
              t.id === String((updated as Record<string, unknown>).id)
                ? { ...t, ...mapped }
                : t
            ),
          } as ApiResponse;
        });
      }, false);
    },
    [mutate, mapUpdatedFields]
  );

  const revalidate = useCallback(() => {
    if (!mutate) return Promise.resolve();
    return mutate();
  }, [mutate]);

  return {
    transactions,
    isLoadingMore,
    isReachingEnd,
    loadMore,
    error,
    size,
    setSize,
    meta,
    // Optimistic update helpers
    updateTransactionOptimistic,
    revalidate,
  };
}
