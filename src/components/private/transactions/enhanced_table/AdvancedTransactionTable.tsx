"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { TransactionRow } from "./TransactionRow";
import { FormattedTransaction } from "@/types/transactions";

interface AdvancedTransactionTableProps {
  transactions: FormattedTransaction[];
  title?: string;
  className?: string;
  onEdit: (transaction: FormattedTransaction) => void;
  onDelete: (transaction: FormattedTransaction) => void;
}

type SortField = "date" | "amount" | "description" | "categoryName";
type SortDirection = "asc" | "desc";

export function AdvancedTransactionTable({
  transactions,
  title = "Transaction History",
  className,
  onEdit,
  onDelete,
}: AdvancedTransactionTableProps) {
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [amountFilter, setAmountFilter] = useState<string>("all");

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Get unique categories for filter dropdown
  const uniqueCategories = useMemo(() => {
    const categories = Array.from(
      new Set(transactions.map((t) => t.categoryName))
    );
    return categories.sort();
  }, [transactions]);

  // Filtered and sorted transactions
  const filteredAndSortedTransactions = useMemo(() => {
    const filtered = transactions.filter((transaction) => {
      // Search filter
      const searchMatch =
        searchTerm === "" ||
        transaction.description
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        transaction.originalDescription
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        transaction.merchantName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        transaction.transaction_number
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      // Category filter
      const categoryMatch =
        categoryFilter === "all" || transaction.categoryName === categoryFilter;

      // Status filter
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "needs-review" && transaction.needsReview) ||
        (statusFilter === "verified" && !transaction.needsReview);

      // Amount filter
      const amountMatch =
        amountFilter === "all" ||
        (amountFilter === "income" && transaction.amount > 0) ||
        (amountFilter === "expense" && transaction.amount < 0);

      return searchMatch && categoryMatch && statusMatch && amountMatch;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: string | number | Date;
      let bValue: string | number | Date;

      switch (sortField) {
        case "date":
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case "amount":
          aValue = Math.abs(a.amount);
          bValue = Math.abs(b.amount);
          break;
        case "description":
          aValue = a.description.toLowerCase();
          bValue = b.description.toLowerCase();
          break;
        case "categoryName":
          aValue = a.categoryName.toLowerCase();
          bValue = b.categoryName.toLowerCase();
          break;
        default:
          aValue = a.date;
          bValue = b.date;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [
    transactions,
    searchTerm,
    categoryFilter,
    statusFilter,
    amountFilter,
    sortField,
    sortDirection,
  ]);

  // Pagination
  const totalPages = Math.ceil(
    filteredAndSortedTransactions.length / itemsPerPage
  );
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredAndSortedTransactions.slice(
    startIndex,
    endIndex
  );

  // Reset to first page when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-gray-400" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 text-blue-600" />
    ) : (
      <ArrowDown className="h-3 w-3 text-blue-600" />
    );
  };

  const reviewCount = filteredAndSortedTransactions.filter(
    (t) => t.needsReview
  ).length;

  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="bg-white border border-gray-200 shadow-lg">
        {/* Enhanced Header */}
        <CardHeader className="pb-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl font-bold text-gray-900 tracking-tight">
                {title}
              </CardTitle>
              <p className="text-sm text-blue-600 mt-2 font-medium">
                Manage and track your financial transactions
              </p>
            </div>
            <div className="flex items-center gap-3">
              {reviewCount > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs bg-orange-50 text-orange-700 border-orange-300 font-semibold px-3 py-1"
                >
                  {reviewCount} need review
                </Badge>
              )}
              <div className="text-sm text-blue-700 font-semibold bg-blue-100 px-4 py-2 rounded-lg border border-blue-200 shadow-sm">
                {filteredAndSortedTransactions.length} of {transactions.length}{" "}
                transactions
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Enhanced Search and Filter Controls */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Search */}
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  handleFilterChange();
                }}
                className="pl-10 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* Category Filter */}
            <Select
              value={categoryFilter}
              onValueChange={(value) => {
                setCategoryFilter(value);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="needs-review">Needs Review</SelectItem>
              </SelectContent>
            </Select>

            {/* Amount Filter */}
            <Select
              value={amountFilter}
              onValueChange={(value) => {
                setAmountFilter(value);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500">
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
              onValueChange={(value) => {
                setItemsPerPage(parseInt(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500">
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
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <ScrollArea className="h-[600px]">
              <Table className="min-w-full">
                {/* Enhanced Sortable Header */}
                <TableHeader className="sticky top-0 z-20 bg-white shadow-sm">
                  <TableRow className="border-b-2 border-gray-200 hover:bg-gray-50">
                    <TableHead
                      className="h-14 px-4 sm:px-6 text-xs font-bold text-gray-700 uppercase tracking-wider w-[120px] cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => handleSort("date")}
                    >
                      <div className="flex items-center gap-2">
                        DATE
                        {getSortIcon("date")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="h-14 px-4 sm:px-6 text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[250px] cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => handleSort("description")}
                    >
                      <div className="flex items-center gap-2">
                        DESCRIPTION
                        {getSortIcon("description")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="h-14 px-4 sm:px-6 text-xs font-bold text-gray-700 uppercase tracking-wider text-right w-[140px] cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => handleSort("amount")}
                    >
                      <div className="flex items-center justify-end gap-2">
                        AMOUNT
                        {getSortIcon("amount")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="h-14 px-4 sm:px-6 text-xs font-bold text-gray-700 uppercase tracking-wider text-center w-[120px] cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => handleSort("categoryName")}
                    >
                      <div className="flex items-center justify-center gap-2">
                        CATEGORY
                        {getSortIcon("categoryName")}
                      </div>
                    </TableHead>
                    <TableHead className="h-14 px-4 sm:px-6 text-xs font-bold text-gray-700 uppercase tracking-wider text-center w-[100px]">
                      STATUS
                    </TableHead>
                    <TableHead className="h-14 px-4 sm:px-6 text-xs font-bold text-gray-700 uppercase tracking-wider text-center w-[80px]">
                      DETAILS
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
                      index={startIndex + index}
                    />
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </CardContent>

        {/* Enhanced Pagination */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, filteredAndSortedTransactions.length)} of{" "}
              {filteredAndSortedTransactions.length} transactions
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="border-gray-300 hover:bg-gray-100"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="border-gray-300 hover:bg-gray-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md">
                {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="border-gray-300 hover:bg-gray-100"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="border-gray-300 hover:bg-gray-100"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
