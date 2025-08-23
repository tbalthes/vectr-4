"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableHead,
} from "@/components/ui/table";
import { CardNp, CardNpContent } from "@/components/ui/card-zero-pad";
import { TransactionRow } from "./TransactionRow";
import { FormattedTransaction } from "@/types/transactions";
import SearchFilterControls from "./SearchFilterControls";

interface TransactionTableProps {
  // Step 2: Update the props to expect FormattedTransaction[]
  transactions: FormattedTransaction[];
  title?: string;
  className?: string;
  onEdit: (transaction: FormattedTransaction) => void;
  onDelete: (transaction: FormattedTransaction) => void;
  onUpdateNote?: (transactionId: string, note: string) => Promise<void>;
}

// sorting is handled inside the SearchFilterControls now

export function TransactionTable({
  transactions,
  className,
  onEdit,
  onDelete,
  onUpdateNote,
}: TransactionTableProps) {
  // Infinite scroll state - optimized for better UX matching the screenshot
  const [displayedTransactions, setDisplayedTransactions] = useState<
    FormattedTransaction[]
  >([]);
  const [filteredAndSortedTransactions, setFilteredAndSortedTransactions] =
    useState<FormattedTransaction[]>(transactions);
  const [total, setTotal] = useState<number>(transactions.length);
  const [loadedCount, setLoadedCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Infinite scroll settings - adjusted to match screenshot visibility
  const INITIAL_LOAD = 20; // Show 20 transactions initially (matches screenshot)
  const LOAD_MORE_COUNT = 15; // Load 15 more when scrolling for smooth experience
  
  // Refs for intersection observer
  const lastTransactionElementRef = useRef<HTMLTableRowElement>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(transactions.map((t) => t.categoryName)))
      .filter(Boolean)
      .sort();
  }, [transactions]);

  // Intersection Observer callback for infinite scroll
  const lastTransactionRef = useCallback(
    (node: HTMLTableRowElement | null) => {
      if (isLoading) return;
      if (observer.current) observer.current.disconnect();
      
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && loadedCount < filteredAndSortedTransactions.length) {
            // Load more transactions when last row is visible
            const newCount = Math.min(
              loadedCount + LOAD_MORE_COUNT,
              filteredAndSortedTransactions.length
            );
            setDisplayedTransactions(filteredAndSortedTransactions.slice(0, newCount));
            setLoadedCount(newCount);
          }
        },
        {
          threshold: 0.1,
          rootMargin: '50px',
        }
      );
      
      if (node) observer.current.observe(node);
    },
    [isLoading, loadedCount, filteredAndSortedTransactions, LOAD_MORE_COUNT]
  );

  // Load more transactions for infinite scroll
  const loadMoreTransactions = useCallback(() => {
    if (isLoading || loadedCount >= filteredAndSortedTransactions.length) return;
    
    setIsLoading(true);
    setTimeout(() => {
      const newCount = Math.min(
        loadedCount + LOAD_MORE_COUNT,
        filteredAndSortedTransactions.length
      );
      setDisplayedTransactions(filteredAndSortedTransactions.slice(0, newCount));
      setLoadedCount(newCount);
      setIsLoading(false);
    }, 300); // Slightly longer delay for smoother UX
  }, [isLoading, loadedCount, filteredAndSortedTransactions, LOAD_MORE_COUNT]);

  // Initialize displayed transactions when filtered data changes
  useEffect(() => {
    const initialCount = Math.min(INITIAL_LOAD, filteredAndSortedTransactions.length);
    setDisplayedTransactions(filteredAndSortedTransactions.slice(0, initialCount));
    setLoadedCount(initialCount);
    setTotal(filteredAndSortedTransactions.length);
  }, [filteredAndSortedTransactions, INITIAL_LOAD]);

  // If the parent `transactions` prop changes, update our local state
  useEffect(() => {
    setFilteredAndSortedTransactions((prev) =>
      prev.map((tx) => transactions.find((t) => t.id === tx.id) || tx)
    );
    setDisplayedTransactions((prev) =>
      prev.map((tx) => transactions.find((t) => t.id === tx.id) || tx)
    );
    setTotal(transactions.length);
  }, [transactions]);

  // Debug: log distinct categoryIcon values returned from the backend so we can
  // verify the frontend receives icon names that match lucide-react exports.
  useEffect(() => {
    try {
      const icons = Array.from(
        new Set(
          transactions.map((t) => {
            const tx = t as unknown as Record<string, unknown>;
            return (
              (typeof tx["categoryIcon"] === "string" &&
                (tx["categoryIcon"] as string)) ||
              (typeof tx["category_name"] === "string" &&
                (tx["category_name"] as string)) ||
              (typeof tx["categoryName"] === "string" &&
                (tx["categoryName"] as string)) ||
              null
            );
          })
        )
      );
      console.debug("TransactionTable: distinct categoryIcon values:", icons);
    } catch (e) {
      console.debug(
        "TransactionTable: error enumerating categoryIcon values",
        e
      );
    }
  }, [transactions]);

  const handleControlsChange = (payload: {
    filtered: FormattedTransaction[];
    paginated: FormattedTransaction[];
    total: number;
    currentPage: number;
    itemsPerPage: number;
  }) => {
    setFilteredAndSortedTransactions(payload.filtered);
    setTotal(payload.total);
    // Reset infinite scroll when filters change
    const initialCount = Math.min(INITIAL_LOAD, payload.filtered.length);
    setDisplayedTransactions(payload.filtered.slice(0, initialCount));
    setLoadedCount(initialCount);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Controls card: Search / Filters / Pagination size */}
      <CardNp className="bg-background/95 backdrop-blur-sm border border-border shadow-sm shadow-black/10 dark:shadow-white/10 rounded-lg overflow-hidden">
        <div className="p-0">
          <SearchFilterControls
            transactions={transactions}
            uniqueCategories={uniqueCategories}
            onChange={handleControlsChange}
          />
        </div>
      </CardNp>

      {/* Header area (separate from the table card)
      <div className="px-2">
        <div className="text-sm text-muted-foreground font-medium">
          Showing {displayedTransactions.length} of {total} transactions
          {loadedCount < total && " (scroll for more)"}
        </div>
      </div> */}

      {/* Table card (table only) */}
      <CardNp className="pt-1 bg-background/95 backdrop-blur-sm border border-border shadow-md shadow-black/10 dark:shadow-white/10 h-full flex flex-col rounded-lg overflow-hidden max-h-[calc(100vh-140px)] min-h-[calc(100vh-140px)]">
        <CardNpContent
          className="flex-1 flex flex-col overflow-auto"
        >
          <Table className="min-w-full flex-1">
            <TableHeader className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm shadow-md shadow-black/10 dark:shadow-white/10 border-b-2 border-border">
              <TableRow className="hover:bg-muted/30 transition-colors">
                <TableHead className="h-10 px-4 sm:px-6 text-xs text-center font-bold text-foreground uppercase tracking-wider w-[120px]">
                  DATE
                </TableHead>
                <TableHead className="h-10 px-4 sm:px-6 text-xs font-bold text-foreground uppercase tracking-wider min-w-[250px]">
                  DESCRIPTION
                </TableHead>
                <TableHead className="h-10 px-4 sm:px-6 text-xs font-bold text-foreground uppercase tracking-wider text-right w-[140px]">
                  AMOUNT
                </TableHead>
                <TableHead className="h-10 px-4 sm:px-6 text-xs font-bold text-foreground uppercase tracking-wider text-center w-[120px]">
                  CATEGORY
                </TableHead>
                <TableHead className="h-10 px-4 sm:px-6 text-xs font-bold text-foreground uppercase tracking-wider text-center w-[100px]">
                  STATUS
                </TableHead>
                <TableHead className="h-10 px-4 sm:px-6 text-xs font-bold text-foreground uppercase tracking-wider text-center w-[80px]">
                  ACTIONS
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedTransactions.map((transaction, index) => {
                const isLast = index === displayedTransactions.length - 1;
                return (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onUpdateNote={onUpdateNote}
                    index={index}
                    ref={isLast ? lastTransactionRef : undefined}
                  />
                );
              })}
              {isLoading && (
                <TableRow>
                  <td colSpan={6} className="text-center py-4 text-muted-foreground">
                    Loading more transactions...
                  </td>
                </TableRow>
              )}
              {!isLoading && loadedCount >= total && total > 0 && (
                <TableRow>
                  <td colSpan={6} className="text-center py-4 text-muted-foreground">
                    All transactions loaded ({total} total)
                  </td>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardNpContent>
      </CardNp>
    </div>
  );
}
