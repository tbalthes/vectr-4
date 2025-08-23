"use client";

import { useState } from "react";
import {
  Edit3,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Flag,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import CategoryIcon from "./CategoryIcon";
import { MerchantLogo } from "./MerchantLogo";
import { TransactionDetails } from "./TransactionDetails";
// Step 1: Import the new, flattened transaction type
import { FormattedTransaction } from "@/types/transactions";

interface TransactionRowProps {
  transaction: FormattedTransaction;
  onEdit: (transaction: FormattedTransaction) => void;
  onDelete: (transaction: FormattedTransaction) => void;
  onUpdateNote?: (transactionId: string, note: string) => Promise<void>;
  // isSelected is now managed by the parent page if needed, but we remove it for simplicity
  // isSelected: boolean;
  index: number;
}

export function TransactionRow({
  transaction,
  onEdit,
  onDelete,
  onUpdateNote,
  index,
}: TransactionRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper function to format the transaction amount and determine its type
  const formatAmount = (amount: number) => {
    const isCredit = amount > 0; // Positive amounts are credits (income)
    const isDebit = amount < 0; // Negative amounts are debits (expenses)

    const formattedAmount = Math.abs(amount).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

    return {
      amount: formattedAmount,
      isCredit,
      isDebit,
      className: isCredit
        ? "text-chart-2 font-semibold" // Green for credits/income
        : "text-red-600 font-semibold", // Red for debits/expenses
    };
  };

  // Helper function to format the date into two parts with better styling
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    return {
      main: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      year: date.getFullYear().toString(),
      isToday,
      fullDate: date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };
  };

  const {
    amount,
    isCredit,
    isDebit,
    className: amountClassName,
  } = formatAmount(transaction.amount);
  const dateFormatted = formatDate(transaction.date);

  return (
    <>
      <TableRow
        className={`group hover:bg-accent/30 transition-colors duration-200 border-b border-border/50 cursor-pointer ${
          index % 2 === 0 ? "bg-background" : "bg-muted/20"
        } ${
          // Step 2: Use the new camelCase prop name
          transaction.needsReview ? "border-l-4 border-l-chart-1" : ""
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Date */}
        <TableCell className="p-2">
          <div className="text-center relative">
            {transaction.needsReview && (
              <Flag className="w-3 h-3 text-chart-1 absolute -top-1 -right-1" />
            )}
            <div
              className={`text-sm font-medium ${
                dateFormatted.isToday ? "text-chart-2" : "text-foreground"
              }`}
            >
              {dateFormatted.main}
            </div>
            <div className="text-xs text-muted-foreground">
              {dateFormatted.year}
            </div>
            {dateFormatted.isToday && (
              <div className="text-xs text-chart-2 font-medium">Today</div>
            )}
          </div>
        </TableCell>

        {/* Description */}
        <TableCell className="p-2">
          <div className="flex items-center gap-3">
            {/* Step 3: Pass data-driven props to MerchantLogo */}
            <MerchantLogo
              merchantName={transaction.merchantName}
              logoUrl={transaction.merchantLogoUrl}
              className="w-8 h-8 flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground truncate flex items-center gap-2">
                {transaction.description}
                {transaction.note && (
                  <StickyNote className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {transaction.categoryName}
              </div>
              {transaction.needsReview && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3 text-chart-1" />
                  <span className="text-xs text-chart-1 font-medium">
                    Review
                  </span>
                </div>
              )}
            </div>
          </div>
        </TableCell>

        {/* Amount */}
        <TableCell className="p-2 text-right">
          <div className="flex items-center justify-end gap-2">
            {isCredit ? (
              <ArrowUpRight className="w-4 h-4 text-chart-2 flex-shrink-0" />
            ) : (
              <ArrowDownLeft className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span className={`text-lg ${amountClassName}`}>
              {isCredit ? "+" : "-"}
              {amount}
            </span>
          </div>
        </TableCell>

        {/* Category Icon */}
        <TableCell className="p-2">
          <div className="flex items-center justify-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 border border-primary/20">
              {/* Step 4: Pass the data-driven icon name to CategoryIcon */}
              <CategoryIcon
                iconName={transaction.categoryIcon}
                className="w-5 h-5 text-primary"
              />
            </div>
          </div>
        </TableCell>

        {/* Status */}
        <TableCell className="p-2 text-center">
          {transaction.needsReview ? (
            <Badge
              variant="outline"
              className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300 hover:bg-yellow-100 cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Add toggle functionality
              }}
            >
              Review
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-xs bg-green-50 text-green-700 border-green-300 hover:bg-green-100 cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Add toggle functionality
              }}
            >
              Verified
            </Badge>
          )}
        </TableCell>

        {/* Details Toggle */}
        <TableCell className="p-2">
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-60 group-hover:opacity-100 transition-opacity duration-200 hover:bg-primary/10 hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(transaction);
              }}
            >
              <Edit3 className="w-4 h-4" />
            </Button>

            <div className="h-8 w-8 p-0 opacity-60 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>
          </div>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="border-b-0 bg-muted/5">
          <TableCell colSpan={6} className="p-0 !bg-background !border-t-0">
            <TransactionDetails
              transaction={transaction}
              onUpdateNote={onUpdateNote}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
