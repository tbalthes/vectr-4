"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableHead,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { TransactionRow } from "./TransactionRow";
// Step 1: Import the new, correct type
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
  // Step 3: Remove the old mock data default. This component should always get its data from the parent page.
  transactions,
  className,
  onEdit,
  onDelete,
  onUpdateNote,
}: TransactionTableProps) {
  // Local state to receive filtered & paginated results from SearchFilterControls
  const [paginatedTransactions, setPaginatedTransactions] = useState<
    FormattedTransaction[]
  >(transactions.slice(0, Math.min(25, transactions.length)));
  const [filteredAndSortedTransactions, setFilteredAndSortedTransactions] =
    useState<FormattedTransaction[]>(transactions);
  const [total, setTotal] = useState<number>(transactions.length);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPageState, setItemsPerPageState] = useState<number>(25);
  const [startIndex, setStartIndex] = useState<number>(0);
  const [endIndex, setEndIndex] = useState<number>(
    Math.min(itemsPerPageState, transactions.length)
  );
  const [totalPages, setTotalPages] = useState<number>(
    Math.max(1, Math.ceil(transactions.length / itemsPerPageState))
  );

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(transactions.map((t) => t.categoryName)))
      .filter(Boolean)
      .sort();
  }, [transactions]);

  // If the parent `transactions` prop changes (for example after an optimistic update),
  // merge those updates into our local filtered/paginated arrays so UI stays in sync.
  useEffect(() => {
    setFilteredAndSortedTransactions((prev) =>
      prev.map((tx) => transactions.find((t) => t.id === tx.id) || tx)
    );
    setPaginatedTransactions((prev) =>
      prev.map((tx) => transactions.find((t) => t.id === tx.id) || tx)
    );
    setTotal(transactions.length);
    setTotalPages(
      Math.max(1, Math.ceil(transactions.length / itemsPerPageState))
    );
  }, [transactions, itemsPerPageState]);

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
    setPaginatedTransactions(payload.paginated);
    setTotal(payload.total);
    setCurrentPage(payload.currentPage);
    setItemsPerPageState(payload.itemsPerPage);
    const s = (payload.currentPage - 1) * payload.itemsPerPage;
    setStartIndex(s);
    setEndIndex(Math.min(payload.total, s + payload.itemsPerPage));
    setTotalPages(Math.max(1, Math.ceil(payload.total / payload.itemsPerPage)));
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Controls card: Search / Filters / Pagination size */}
      <Card className="bg-background border border-border drop-shadow-md">
        <div className="p-0">
          <SearchFilterControls
            transactions={transactions}
            uniqueCategories={uniqueCategories}
            onChange={handleControlsChange}
          />
        </div>
      </Card>

      {/* Header area (separate from the table card) */}
      <div className="px-2">
        <div className="text-sm text-muted-foreground font-medium">
          Showing {total === 0 ? 0 : startIndex + 1} to{" "}
          {Math.min(endIndex, total)} of {total} transactions
        </div>
      </div>

      {/* Table card (table only) */}
      <Card className="bg-background border border-border drop-shadow-sm h-full flex flex-col">
        <CardContent className="-px-6 flex-1 flex flex-col">
          <Table className="min-w-full flex-1">
            <TableHeader className="sticky top-0 z-20 bg-background shadow-sm border-b-2 border-border">
              <TableRow className="hover:bg-muted/50 transition-colors">
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
              {paginatedTransactions.map((transaction, index) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onUpdateNote={onUpdateNote}
                  index={startIndex + index}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
