"use client";

import React, { useMemo, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { FormattedTransaction } from "@/types/transactions";

// Replace corrupted file: implement a self-contained SearchFilterControls component that
// owns search/filter/sort/pagination state and emits paginated results via onChange.

type SearchFilterControlsProps = {
  transactions?: FormattedTransaction[];
  uniqueCategories?: string[];
  className?: string;
  onChange?: (payload: {
    filtered: FormattedTransaction[];
    paginated: FormattedTransaction[];
    total: number;
    currentPage: number;
    itemsPerPage: number;
  }) => void;
};

export default function SearchFilterControls({
  transactions = [],
  uniqueCategories = [],
  className = "",
  onChange,
}: SearchFilterControlsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [amountFilter, setAmountFilter] = useState<string>("all");
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  // keep as state in case we later expose setters; disable unused-vars lint for setters
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sortField, setSortField] = useState<"date" | "amount" | "description" | "categoryName">("date");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const categories = useMemo(() => {
    if (uniqueCategories && uniqueCategories.length > 0) return uniqueCategories;
    const cats = Array.from(new Set((transactions || []).map((t) => t.categoryName || ""))).filter(Boolean);
    return cats.sort();
  }, [uniqueCategories, transactions]);

  // Helper: filter & sort (used by memo and by handlers so we can compute results synchronously)
  const filterAndSort = useCallback((overrides?: Partial<{
    searchTerm: string;
    categoryFilter: string;
    statusFilter: string;
    amountFilter: string;
    sortField: "date" | "amount" | "description" | "categoryName";
    sortDirection: "asc" | "desc";
  }>) => {
    const s = (overrides?.searchTerm ?? searchTerm).trim().toLowerCase();
    const cat = overrides?.categoryFilter ?? categoryFilter;
    const status = overrides?.statusFilter ?? statusFilter;
    const amount = overrides?.amountFilter ?? amountFilter;
    const sField = overrides?.sortField ?? sortField;
    const sDir = overrides?.sortDirection ?? sortDirection;

    const filtered = (transactions || []).filter((transaction) => {
      const searchMatch =
        s === "" ||
        ((transaction.description || "").toLowerCase().includes(s)) ||
        ((transaction.originalDescription || "").toLowerCase().includes(s)) ||
        ((transaction.merchantName || "").toLowerCase().includes(s)) ||
        ((transaction.transaction_number || "").toLowerCase().includes(s));

      const categoryMatch = cat === "all" || transaction.categoryName === cat;

      const statusMatch =
        status === "all" ||
        (status === "needs-review" && transaction.needsReview) ||
        (status === "verified" && !transaction.needsReview);

      const amountMatch =
        amount === "all" ||
        (amount === "income" && transaction.amount > 0) ||
        (amount === "expense" && transaction.amount < 0);

      return searchMatch && categoryMatch && statusMatch && amountMatch;
    });

    filtered.sort((a, b) => {
      let aValue: Date | number | string = a.date as unknown as string;
      let bValue: Date | number | string = b.date as unknown as string;
      switch (sField) {
        case "date":
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case "amount":
          aValue = Math.abs(a.amount);
          bValue = Math.abs(b.amount);
          break;
        case "description":
          aValue = (a.description || "").toLowerCase();
          bValue = (b.description || "").toLowerCase();
          break;
        case "categoryName":
          aValue = (a.categoryName || "").toLowerCase();
          bValue = (b.categoryName || "").toLowerCase();
          break;
      }
      if (aValue < bValue) return sDir === "asc" ? -1 : 1;
      if (aValue > bValue) return sDir === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [transactions, searchTerm, categoryFilter, statusFilter, amountFilter, sortField, sortDirection]);

  const filteredAndSorted = useMemo(() => filterAndSort(), [filterAndSort]);
  // Removed: const totalPages (no longer needed after pagination controls removal)

  // paginated list is produced and emitted on user interactions; keep slice available to handlers

  // Emit only on user interactions to avoid an update loop with the parent
  const emitChange = (filtered: FormattedTransaction[], paginatedList: FormattedTransaction[], curPage: number, ipp: number) => {
    onChange?.({ filtered, paginated: paginatedList, total: filtered.length, currentPage: curPage, itemsPerPage: ipp });
  };

  // Handlers that compute results synchronously and emit to parent
  const handleSearchChange = (value: string) => {
    const newPage = 1;
    const filtered = filterAndSort({ searchTerm: value });
    const pag = filtered.slice(0, itemsPerPage);
    setSearchTerm(value);
    setCurrentPage(newPage);
    emitChange(filtered, pag, newPage, itemsPerPage);
  };

  const handleCategoryChange = (value: string) => {
    const newPage = 1;
    const filtered = filterAndSort({ categoryFilter: value });
    const pag = filtered.slice(0, itemsPerPage);
    setCategoryFilter(value);
    setCurrentPage(newPage);
    emitChange(filtered, pag, newPage, itemsPerPage);
  };

  const handleStatusChange = (value: string) => {
    const newPage = 1;
    const filtered = filterAndSort({ statusFilter: value });
    const pag = filtered.slice(0, itemsPerPage);
    setStatusFilter(value);
    setCurrentPage(newPage);
    emitChange(filtered, pag, newPage, itemsPerPage);
  };

  const handleAmountChange = (value: string) => {
    const newPage = 1;
    const filtered = filterAndSort({ amountFilter: value });
    const pag = filtered.slice(0, itemsPerPage);
    setAmountFilter(value);
    setCurrentPage(newPage);
    emitChange(filtered, pag, newPage, itemsPerPage);
  };

  const handleItemsPerPageChange = (newIpp: number) => {
    const newPage = 1;
    setItemsPerPage(newIpp);
    setCurrentPage(newPage);
    const filtered = filteredAndSorted;
    const pag = filtered.slice(0, newIpp);
    emitChange(filtered, pag, newPage, newIpp);
  };

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    const filtered = filteredAndSorted;
    const pag = filtered.slice((newPage - 1) * itemsPerPage, newPage * itemsPerPage);
    setCurrentPage(newPage);
    emitChange(filtered, pag, newPage, itemsPerPage);
  };

  // Pagination navigation handled by parent TransactionTable

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          {/* Left: Filters/Search */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500 shadow-sm min-w-[180px]"
              />
            </div>
            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={handleCategoryChange}>
              <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500 shadow-sm min-w-[140px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500 shadow-sm min-w-[120px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="needs-review">Needs Review</SelectItem>
              </SelectContent>
            </Select>
            {/* Amount Filter */}
            <Select value={amountFilter} onValueChange={handleAmountChange}>
              <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500 shadow-sm min-w-[120px]">
                <SelectValue placeholder="All Amounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Amounts</SelectItem>
                <SelectItem value="income">Income Only</SelectItem>
                <SelectItem value="expense">Expenses Only</SelectItem>
              </SelectContent>
            </Select>
            {/* Items per page */}
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => handleItemsPerPageChange(parseInt(value))}
            >
              <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500 shadow-sm min-w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="25">25 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Right: Pagination */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              className="px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 text-xs hover:bg-gray-100 disabled:opacity-50"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              aria-label="First page"
            >
              &#171;
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 text-xs hover:bg-gray-100 disabled:opacity-50"
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              &#8249;
            </button>
            <span className="px-2 text-xs text-gray-700">
              {currentPage} / {Math.max(1, Math.ceil(filteredAndSorted.length / itemsPerPage))}
            </span>
            <button
              type="button"
              className="px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 text-xs hover:bg-gray-100 disabled:opacity-50"
              onClick={() => handlePageChange(Math.min(Math.max(1, Math.ceil(filteredAndSorted.length / itemsPerPage)), currentPage + 1))}
              disabled={currentPage === Math.max(1, Math.ceil(filteredAndSorted.length / itemsPerPage))}
              aria-label="Next page"
            >
              &#8250;
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 text-xs hover:bg-gray-100 disabled:opacity-50"
              onClick={() => handlePageChange(Math.max(1, Math.ceil(filteredAndSorted.length / itemsPerPage)))}
              disabled={currentPage === Math.max(1, Math.ceil(filteredAndSorted.length / itemsPerPage))}
              aria-label="Last page"
            >
              &#187;
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}