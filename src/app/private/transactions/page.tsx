'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import TransactionTableVirtuoso from '@/components/private/transactions/enhanced_table/TransactionTableVirtuoso';
import { TransactionDetailsDrawer } from '@/components/private/transactions/enhanced_table/TransactionDetailsDrawer';
import { Button } from '@/components/ui/button';
import type { FormattedTransaction } from '@/types/transactions';
import type { DateRange } from '@/components/private/transactions/filters/DateRangePicker';
import { DateRangePicker } from '@/components/private/transactions/filters/DateRangePicker';
import type { AdvancedFilterState } from '@/components/private/transactions/filters/AdvancedFilterPanel';
import { AdvancedFilterPanel } from '@/components/private/transactions/filters/AdvancedFilterPanel';
import {
  useInfiniteTransactions,
  type TransactionItem,
  type GroupedTransactionItem,
} from '@/hooks/useInfiniteTransactions';
import PageHeader from '@/components/private/PageHeader';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export default function TransactionsPage() {
  // Get authenticated user
  const { user } = useAuth();

  // TODO: Integrate useInfiniteTransactions and new data flow (WBS 3.1)
  // Placeholder for future filter panel (WBS 5.1)
  const [search, setSearch] = useState('');
  const [selectedCategory] = useState('all');
  const [selectedAmount] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [sortBy, _setSortBy] = useState<'date' | 'amount' | 'transaction_number'>('date');
  const [sortOrder, _setSortOrder] = useState<'asc' | 'desc'>('desc');
  const router = useRouter();

  // Advanced filter state
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterState>({
    selectedCategories: [],
    selectedMerchants: [],
    selectedAccounts: [],
    selectedTags: [],
    selectedGoals: [],
    amountType: 'all',
    amountMin: undefined,
    amountMax: undefined,
    dateRange: {},
    otherFilters: {
      needsReview: false,
      hasAttachments: false,
      isRecurring: false,
      hasNotes: false,
      uncategorized: false,
    },
  });

  // Drawer state
  const [drawerTransactionId, setDrawerTransactionId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);

  // Debounced search state
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Convert filter state to API parameters
  const apiFilters = {
    q: debouncedSearch,
    sortBy,
    sortOrder,
    pageSize: 50,
    // Use advanced filters if they have values, otherwise fall back to simple filters
    // Date range filters
    ...(advancedFilters.dateRange.from && {
      dateFrom: advancedFilters.dateRange.from.toISOString(),
    }),
    ...(advancedFilters.dateRange.to && {
      dateTo: advancedFilters.dateRange.to.toISOString(),
    }),
    // Fallback to simple date range if advanced not set
    ...(!advancedFilters.dateRange.from &&
      !advancedFilters.dateRange.to &&
      dateRange.from && { dateFrom: dateRange.from.toISOString() }),
    ...(!advancedFilters.dateRange.from &&
      !advancedFilters.dateRange.to &&
      dateRange.to && { dateTo: dateRange.to.toISOString() }),

    // Category filter - use advanced filters if set, otherwise simple
    ...(advancedFilters.selectedCategories.length > 0 && {
      category: advancedFilters.selectedCategories.join(','),
    }),
    ...(!advancedFilters.selectedCategories.length &&
      selectedCategory !== 'all' && { category: selectedCategory }),

    // Amount filter - use advanced filters if set, otherwise simple
    ...(advancedFilters.amountType !== 'all' && {
      amountType: advancedFilters.amountType,
    }),
    ...(!advancedFilters.amountType ||
      (advancedFilters.amountType === 'all' &&
        selectedAmount !== 'all' && {
          amountType: selectedAmount as 'income' | 'expense',
        })),

    // Amount range
    ...(advancedFilters.amountMin !== undefined && {
      amountMin: advancedFilters.amountMin,
    }),
    ...(advancedFilters.amountMax !== undefined && {
      amountMax: advancedFilters.amountMax,
    }),

    // Other advanced filters
    ...(advancedFilters.selectedMerchants.length > 0 && {
      merchants: advancedFilters.selectedMerchants.join(','),
    }),
    ...(advancedFilters.otherFilters.needsReview && { needsReview: true }),
    ...(advancedFilters.otherFilters.uncategorized && { uncategorized: true }),
  };

  // Infinite loading hook with server-side filtering
  const {
    transactions: allTransactions,
    isLoading,
    isReachingEnd,
    loadMore,
    error,
    updateTransactionOptimistic,
    revalidate,
  } = useInfiniteTransactions(apiFilters);

  // Use server-filtered transactions directly
  const filteredTransactions = allTransactions;

  // Rebuild the transaction list with proper date headers
  const rebuildWithDateHeaders = (items: GroupedTransactionItem[]) => {
    const result: GroupedTransactionItem[] = [];
    let currentDate = '';

    for (const item of items) {
      // Skip explicit date-header items coming from the hook
      if (item.type === 'date-header') {
        continue;
      }

      // item is a TransactionItem
      const tx = item.data;
      const transactionDate = new Date(tx.date).toDateString();

      if (transactionDate !== currentDate) {
        currentDate = transactionDate;
        const date = new Date(transactionDate);
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
            day: 'numeric',
          });
        }

        // Calculate daily total for this date by summing amounts of transaction items
        const dailyTotal = items
          .filter((it): it is TransactionItem => it.type === 'transaction')
          .map((it) => it.data)
          .filter((t) => new Date(t.date).toDateString() === transactionDate)
          .reduce((sum, t) => sum + t.amount, 0);

        result.push({
          type: 'date-header',
          date: transactionDate,
          displayDate,
          id: `date-header-${transactionDate}`,
          dailyTotal,
        });
      }

      result.push({ type: 'transaction', data: tx });
    }

    return result;
  };

  const finalTransactions = rebuildWithDateHeaders(filteredTransactions);

  console.log('TransactionsPage render:', {
    transactionsCount: finalTransactions.length,
    allTransactionsCount: allTransactions.length,
    isLoading,
    isReachingEnd,
    error,
    firstTransaction: finalTransactions[0],
    hasLoadMore: !!loadMore,
    selectedCategory,
    selectedAmount,
  });

  const handleEditTransaction = (_transaction: FormattedTransaction) => {
    void _transaction;
  };
  const handleDeleteTransaction = (_transaction: FormattedTransaction) => {
    void _transaction;
  };

  // Drawer edit handler
  // Accept the full edited transaction object from the drawer (including
  // merchant_name, category_name, and optional *_id fields) so those fields
  // are included when we call the API. Use a loose type to avoid strict
  // coupling with the drawer's DetailedTransaction type.
  const handleDrawerEdit = async (
    transaction: Record<string, unknown> & {
      id: string;
      __explicit_save?: boolean;
    },
  ) => {
    // Optimistic update: apply locally first, but don't close the drawer until
    // the server confirms success. On failure, rollback via revalidation.
    let didOptimisticallyUpdate = false;
    try {
      // Ignore accidental/on-the-fly edits from the drawer; only proceed when
      // the drawer sends an explicit save flag.
      if (!transaction.__explicit_save) {
        console.log('handleDrawerEdit: ignoring non-explicit edit', transaction.id);
        return;
      }

      console.log('handleDrawerEdit: saving transaction', transaction);

      // Apply optimistic update first
      if (updateTransactionOptimistic) {
        updateTransactionOptimistic(transaction.id, transaction as Record<string, unknown>);
        didOptimisticallyUpdate = true;
        console.log('Applied optimistic update for transaction:', transaction.id);
      }

      // Persist to server
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(transaction),
      });

      if (!response.ok) {
        throw new Error(`Failed to update transaction: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Transaction updated successfully:', result);

      // Wait a bit before revalidating to ensure DB has updated
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Revalidate from server for final truth, but preserve optimistic updates
      if (revalidate) {
        await revalidate();
        console.log('Data revalidated from server');
      }

      // Close the drawer only after a successful save
      handleCloseDrawer();
    } catch (err) {
      console.error('Error updating transaction:', err);
      // Rollback by revalidating from server if we applied an optimistic update
      try {
        if (didOptimisticallyUpdate && revalidate) {
          await revalidate();
          console.log('Rolled back optimistic update due to error');
        }
      } catch (reErr) {
        console.error('Error revalidating after failed update:', reErr);
      }
      // Keep the drawer open so the user can retry or correct the data
      // TODO: show error notification to user (toast)
    }
  };

  // Drawer delete handler (called from TransactionDetailsDrawer)
  const handleDrawerDelete = async (transactionId: string) => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete transaction: ${response.statusText}`);
      }

      // Revalidate the transactions cache
      if (revalidate) {
        await revalidate();
      }

      // Close the drawer if still open
      handleCloseDrawer();
    } catch (err) {
      console.error('Error deleting transaction:', err);
      // Attempt to revalidate to ensure UI reflects server
      try {
        if (revalidate) {
          await revalidate();
        }
      } catch (reErr) {
        console.error('Error revalidating after failed delete:', reErr);
      }
      // TODO: surface error to user via toast/notification
    }
  };

  const handleUpdateNote = async (_transactionId: string, _note: string) => {
    // Use params to avoid TS unused variable errors and reserve for WBS 6 optimistic updates.
    void _transactionId;
    void _note;
    // Note: optimistic updates/mutations will be integrated in WBS 6.
    return Promise.resolve();
  };

  // Drawer handlers
  const handleOpenDetails = (transactionId: string) => {
    setDrawerTransactionId(transactionId);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setDrawerTransactionId(null);
  };

  // TODO: Render loading, error, and empty states using new hook (WBS 3.1)
  return (
    <>
      <style jsx global>{`
        /* Hide browser scrollbars */
        html,
        body {
          overflow: hidden;
        }
            isLoading={isLoading}
        /* Ensure the page content can scroll */
        #__next {
          height: 100vh;
          overflow: hidden;
        }
      `}</style>
      <PageHeader
        title="Transactions"
        subtitle=""
        actions={
          <div className="flex items-center space-x-3">
            <input
              type="text"
              className="border rounded px-2 py-1 text-sm"
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 200 }}
            />
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder="Select date range..."
            />

            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                  <SheetTitle>Advanced Filters</SheetTitle>
                  <SheetDescription>
                    Apply advanced filters to refine your transaction search
                  </SheetDescription>
                </SheetHeader>

                <AdvancedFilterPanel
                  isOpen={filtersOpen}
                  onClose={() => setFiltersOpen(false)}
                  filters={advancedFilters}
                  onFiltersChange={setAdvancedFilters}
                  onApply={() => {
                    // Filters are automatically applied via the apiFilters effect
                    setFiltersOpen(false);
                  }}
                  userId={user?.id}
                  onClear={() => {
                    setAdvancedFilters({
                      selectedCategories: [],
                      selectedMerchants: [],
                      selectedAccounts: [],
                      selectedTags: [],
                      selectedGoals: [],
                      amountType: 'all',
                      amountMin: undefined,
                      amountMax: undefined,
                      dateRange: {},
                      otherFilters: {
                        needsReview: false,
                        hasAttachments: false,
                        isRecurring: false,
                        hasNotes: false,
                        uncategorized: false,
                      },
                    });
                  }}
                />
              </SheetContent>
            </Sheet>
            <Button variant="outline" size="sm" onClick={() => router.push('/private/rules')}>
              Edit rules
            </Button>
            <Button size="sm" onClick={() => router.push('/private/upload')}>
              <Plus className="mr-2 h-4 w-4" />
              Add transaction
            </Button>
          </div>
        }
      />

      <div className="h-full overflow-hidden bg-background dark:bg-background">
        {error ? (
          <div className="text-destructive dark:text-destructive font-semibold p-3">
            Failed to load transactions.
          </div>
        ) : null}
        {!error && finalTransactions.length === 0 && !isLoading && (
          <div className="flex justify-center items-center h-full text-muted-foreground dark:text-muted-foreground">
            No transactions found.
          </div>
        )}

        <TransactionTableVirtuoso
          transactions={finalTransactions}
          onEdit={handleEditTransaction}
          onDelete={handleDeleteTransaction}
          onUpdateNote={handleUpdateNote}
          onOpenDetails={handleOpenDetails}
          loadMore={loadMore}
          isReachingEnd={isReachingEnd}
          isLoading={isLoading}
        />
      </div>

      {/* Transaction Details Drawer */}
      <TransactionDetailsDrawer
        transactionId={drawerTransactionId}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onEdit={(transaction) => {
          void handleDrawerEdit(transaction);
        }}
        onDelete={(transactionId) => {
          void handleDrawerDelete(transactionId);
        }}
      />
    </>
  );
}
