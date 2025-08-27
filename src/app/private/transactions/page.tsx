"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TransactionTableVirtuoso from "@/components/private/transactions/enhanced_table/TransactionTableVirtuoso";
import { TransactionDetailsDrawer } from "@/components/private/transactions/enhanced_table/TransactionDetailsDrawer";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, Filter } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FormattedTransaction } from "@/types/transactions";
import { useInfiniteTransactions, type TransactionItem } from "@/hooks/useInfiniteTransactions";
import PageHeader from "@/components/private/PageHeader";

// Hook to fetch all available categories
function useAllCategories() {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/analytics/aggregator?view=categories&namesOnly=true", {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch categories: ${response.status}`);
        }
        const data = await response.json();
        setCategories(data.data || []);
      } catch (err) {
        console.error("Error fetching categories:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch categories");
        // Fallback to some default categories
        setCategories(["Food", "Transport", "Shopping", "Entertainment", "Bills"]);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, loading, error };
}

export default function TransactionsPage() {
  // TODO: Integrate useInfiniteTransactions and new data flow (WBS 3.1)
  // Placeholder for future filter panel (WBS 5.1)
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedAmount, setSelectedAmount] = useState("all");
  const [sortBy, setSortBy] = useState<
    "date" | "amount" | "transaction_number"
  >("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const router = useRouter();

  // Fetch all available categories
  const { categories: allCategories } = useAllCategories();

  // Add "Uncategorized" to the categories list if it's not already there
  const categoriesWithUncategorized = allCategories.includes("Uncategorized")
    ? allCategories
    : [...allCategories, "Uncategorized"];

  // Drawer state
  const [drawerTransactionId, setDrawerTransactionId] = useState<string | null>(
    null
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);

  // Debounced search state
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Infinite loading hook - only use search for now since API doesn't support category filtering
  const { transactions: allTransactions, isLoadingMore, isReachingEnd, loadMore, error } =
    useInfiniteTransactions({
      q: debouncedSearch,
      sortBy,
      sortOrder,
      pageSize: 50,
    });

  // Client-side filtering based on selected filters
  const filteredTransactions = allTransactions.filter((transaction) => {
    // Skip date headers for filtering
    if ('type' in transaction && transaction.type === 'date-header') {
      return true; // Always include date headers initially, we'll rebuild them
    }

    const tx = transaction as FormattedTransaction;

    // Category filter
    if (selectedCategory !== "all") {
      if (selectedCategory === "Uncategorized") {
        // Show transactions with no category or "Uncategorized"
        if (tx.categoryName && tx.categoryName !== "Uncategorized") {
          return false;
        }
      } else if (tx.categoryName !== selectedCategory) {
        return false;
      }
    }

    // Amount filter
    if (selectedAmount === "income" && tx.amount <= 0) {
      return false;
    }
    if (selectedAmount === "expense" && tx.amount >= 0) {
      return false;
    }

    return true;
  });

  // Rebuild the transaction list with proper date headers
  const rebuildWithDateHeaders = (transactions: TransactionItem[]) => {
    const result: TransactionItem[] = [];
    let currentDate = '';

    for (const transaction of transactions) {
      if ('type' in transaction && transaction.type === 'date-header') {
        continue; // Skip old date headers
      }

      const tx = transaction as FormattedTransaction;
      const transactionDate = new Date(tx.date).toDateString();

      if (transactionDate !== currentDate) {
        currentDate = transactionDate;
        const date = new Date(transactionDate);
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

        // Calculate daily total for this date
        const dailyTotal = transactions
          .filter(t => !('type' in t) || t.type !== 'date-header')
          .filter(t => new Date((t as FormattedTransaction).date).toDateString() === transactionDate)
          .reduce((sum, t) => sum + (t as FormattedTransaction).amount, 0);

        result.push({
          type: "date-header",
          date: transactionDate,
          displayDate,
          id: `date-header-${transactionDate}`,
          dailyTotal,
        });
      }

      result.push(tx);
    }

    return result;
  };

  const finalTransactions = rebuildWithDateHeaders(filteredTransactions);

  console.log("TransactionsPage render:", {
    transactionsCount: finalTransactions.length,
    allTransactionsCount: allTransactions.length,
    isLoadingMore,
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
  const handleDeleteTransaction = async (
    _transaction: FormattedTransaction
  ) => {
    void _transaction;
  };

  // Drawer edit handler
  const handleDrawerEdit = async (transaction: {
    id: string;
    transaction_number: string;
    date: string;
    clean_description: string;
    original_description: string;
    amount: number;
    balance: number | null;
    transaction_note: string | null;
    needs_review: boolean;
  }) => {
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transaction),
      });

      if (!response.ok) {
        throw new Error(`Failed to update transaction: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("Transaction updated successfully:", result);

      // Optionally refresh the transactions list or update optimistically
      // For now, we'll just log success
    } catch (error) {
      console.error("Error updating transaction:", error);
      // TODO: Show error toast/notification
    }
  };

  // Drawer delete handler
  const handleDrawerDelete = async (transactionId: string) => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete transaction: ${response.statusText}`);
      }

      console.log("Transaction deleted successfully");

      // Close the drawer and optionally refresh the list
      handleCloseDrawer();
      // TODO: Remove from local state or refresh transactions
    } catch (error) {
      console.error("Error deleting transaction:", error);
      // TODO: Show error toast/notification
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
            <select
              value={sortBy}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setSortBy(
                  e.target.value as "date" | "amount" | "transaction_number"
                )
              }
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="date">Date</option>
              <option value="amount">Amount</option>
              <option value="transaction_number">Transaction #</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setSortOrder(e.target.value as "asc" | "desc")
              }
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Date
            </Button>
            <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Filters</h4>
                    <p className="text-sm text-muted-foreground">
                      Apply filters to narrow down your transactions.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <div className="grid grid-cols-3 items-center gap-4">
                      <label htmlFor="category">Category</label>
                      <select
                        id="category"
                        className="col-span-2 h-8"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                      >
                        <option value="all">All Categories</option>
                        {categoriesWithUncategorized.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <label htmlFor="amount">Amount</label>
                      <select
                        id="amount"
                        className="col-span-2 h-8"
                        value={selectedAmount}
                        onChange={(e) => setSelectedAmount(e.target.value)}
                      >
                        <option value="all">All Amounts</option>
                        <option value="income">Income Only</option>
                        <option value="expense">Expenses Only</option>
                      </select>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm">
              Edit rules
            </Button>
            <Button size="sm" onClick={() => router.push("/private/upload")}>
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
        {!error && finalTransactions.length === 0 && !isLoadingMore && (
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
          isLoadingMore={isLoadingMore}
        />
      </div>

      {/* Transaction Details Drawer */}
      <TransactionDetailsDrawer
        transactionId={drawerTransactionId}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onEdit={handleDrawerEdit}
        onDelete={handleDrawerDelete}
      />
    </>
  );
}
