"use client";

import React from "react";
import { ChevronRight, Flag, StickyNote } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import CategoryIcon from "./CategoryIcon";
import MerchantLogo from "./MerchantLogo";
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
  onOpenDetails?: (transactionId: string) => void;
}

export function TransactionRow({
  transaction,
  // onEdit,
  // onDelete, // Temporarily unused
  // onUpdateNote, // Temporarily unused
  // index, // Temporarily unused
  onOpenDetails,
}: TransactionRowProps) {
  // Helper function to format the transaction amount and determine its type
  const formatAmount = (
    amount: number
  ): {
    amount: string;
    isCredit: boolean;
    isDebit: boolean;
    className: string;
  } => {
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
        ? "text-chart-2 dark:text-chart-2 font-semibold" // Green for credits/income in both themes
        : "text-foreground dark:text-foreground font-semibold", // Default text for debits/expenses
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
    className: amountClassName,
  } = formatAmount(transaction.amount);
  // dateFormatted reserved for future use
  void formatDate(transaction.date);

  const handleOpenDetails = () => {
    if (onOpenDetails) {
      onOpenDetails(transaction.id);
    }
  };

  return (
    <>
      {/* Merchant Logo */}
      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 group-hover:bg-accent/30 dark:group-hover:bg-accent/20 transition-colors duration-200">
        <div className="flex items-center justify-center">
          <MerchantLogo
            merchantName={transaction.merchantName}
            logoUrl={transaction.merchantLogoUrl}
            className="w-7 h-7 flex-shrink-0"
          />
        </div>
      </td>

      {/* Description */}
      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 group-hover:bg-accent/30 dark:group-hover:bg-accent/20 transition-colors duration-200">
        <div className="flex flex-col">
          <div className="font-medium text-foreground dark:text-foreground truncate flex items-center gap-2 text-xs">
            {transaction.description}
            {transaction.note && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center ml-1" tabIndex={0}>
                    <StickyNote className="w-4 h-4 text-foreground dark:text-foreground flex-shrink-0" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs break-words">
                  {transaction.note}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="text-2xs text-muted-foreground dark:text-muted-foreground truncate mt-0.5">
            {transaction.categoryName}
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 group-hover:bg-accent/30 dark:group-hover:bg-accent/20 transition-colors duration-200">
        <div className="flex items-center justify-center">
          <CategoryIcon
            iconName={transaction.categoryIcon}
            className="w-6 h-6 text-primary dark:text-primary"
          />
        </div>
      </td>

      {/* Account */}
      <td className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 group-hover:bg-accent/30 dark:group-hover:bg-accent/20 transition-colors duration-200">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-muted dark:bg-muted flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground dark:bg-muted-foreground"></div>
          </div>
          <span className="text-xs text-foreground dark:text-foreground truncate">
            My Money (...2733)
          </span>
        </div>
      </td>

      {/* Amount */}
      <td className="px-3 py-2 text-right border-b border-gray-200 dark:border-gray-800 group-hover:bg-accent/30 dark:group-hover:bg-accent/20 transition-colors duration-200">
        <div className="flex items-center justify-end gap-3">
          {(!transaction.categoryName ||
            transaction.categoryName === "Uncategorized" ||
            transaction.categoryName === "") && (
            <Flag className="w-4 h-4 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
          )}
          <span
            className={`text-sm font-medium ${amountClassName} dark:text-chart-2`}
          >
            {isCredit ? "+" : ""}
            {amount}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted"
            onClick={handleOpenDetails}
          >
            <ChevronRight className="w-5 h-5 text-muted-foreground dark:text-muted-foreground" />
          </Button>
        </div>
      </td>
    </>
  );
}

export default TransactionRow;
