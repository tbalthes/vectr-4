'use client';

import React from 'react';
import { ChevronRight, Flag, StickyNote } from 'lucide-react';

// Relative imports (local to this folder)
import CategoryIcon from './CategoryIcon';
import MerchantLogo from './MerchantLogo';

// Absolute imports (internal shared components)
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import type { FormattedTransaction } from '@/types/transactions';

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
    amount: number,
  ): {
    amount: string;
    isCredit: boolean;
    isDebit: boolean;
    className: string;
  } => {
    const isCredit = amount > 0; // Positive amounts are credits (income)
    const isDebit = amount < 0; // Negative amounts are debits (expenses)

    const formattedAmount = amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });

    return {
      amount: formattedAmount,
      isCredit,
      isDebit,
      className: isCredit
        ? 'text-chart-2 dark:text-chart-2 font-semibold' // Green for credits/income in both themes
        : 'text-foreground dark:text-foreground font-semibold', // Default text for debits/expenses
    };
  };

  // Helper function to format the date into two parts with better styling
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    return {
      main: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      year: date.getFullYear().toString(),
      isToday,
      fullDate: date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    };
  };

  const { amount, className: amountClassName } = formatAmount(transaction.amount);
  // dateFormatted reserved for future use
  void formatDate(transaction.date);

  const handleOpenDetails = () => {
    if (onOpenDetails) {
      // FormattedTransaction uses transactionId as the identifier
      onOpenDetails(transaction.transactionId);
    }
  };

  // Fallback: derive an icon from category name/code if backend didn't supply one
  const mapCategoryToIcon = (name?: string | null): string | undefined => {
    if (!name) {
      return undefined;
    }
    const n = String(name).trim();
    const upper = n.toUpperCase().replace(/\s+/g, '_');
    const table: Record<string, string> = {
      // Common Plaid-style machine keys
      FOOD_AND_DRINK: 'Utensils',
      GROCERIES: 'ShoppingCart',
      TRANSPORTATION: 'Car',
      TRAVEL: 'Plane',
      RENT_AND_UTILITIES: 'Home',
      HOME: 'Home',
      ENTERTAINMENT: 'Ticket',
      SHOPPING: 'ShoppingBag',
      HEALTHCARE: 'HeartPulse',
      BANK_FEES: 'Receipt',
      TRANSFER: 'ArrowLeftRight',
      INCOME: 'DollarSign',
      PAYCHECK: 'BadgeDollarSign',
      SUBSCRIPTIONS: 'Repeat',
      EDUCATION: 'GraduationCap',
      GIFTS_AND_DONATIONS: 'Gift',
      TAXES: 'FileText',
      INVESTMENTS: 'LineChart',
      // Human-readable fallbacks
      'FOOD & DRINK': 'Utensils',
      GROCERIES_TXT: 'ShoppingCart',
      TRANSPORT: 'Car',
      UTILITIES: 'Home',
      ENTERTAINMENT_TXT: 'Ticket',
      SHOPPING_TXT: 'ShoppingBag',
    };
    // Try exact machine key
    if (table[upper]) {
      return table[upper];
    }
    // Try contains-based heuristics
    if (/FOOD|DRINK|RESTAURANT|DINING/i.test(n)) {
      return 'Utensils';
    }
    if (/GROCERY|SUPERMARKET/i.test(n)) {
      return 'ShoppingCart';
    }
    if (/TRAVEL|FLIGHT|HOTEL/i.test(n)) {
      return 'Plane';
    }
    if (/TRANSPORT|UBER|LYFT|GAS|FUEL|CAR/i.test(n)) {
      return 'Car';
    }
    if (/RENT|MORTGAGE|UTILIT|HOME/i.test(n)) {
      return 'Home';
    }
    if (/FEE|CHARGE/i.test(n)) {
      return 'Receipt';
    }
    if (/INCOME|PAY/i.test(n)) {
      return 'DollarSign';
    }
    if (/TRANSFER/i.test(n)) {
      return 'ArrowLeftRight';
    }
    return undefined;
  };

  const resolvedIconName = transaction.categoryIcon ?? mapCategoryToIcon(transaction.categoryName);

  return (
    <>
      {/* Merchant Logo */}
      <td className="px-3 py-2 bg-background dark:bg-background border-b border-gray-50 dark:border-gray-800">
        <div className="flex items-center justify-center">
          <MerchantLogo
            merchantName={transaction.merchantName ?? ''}
            logoUrl={transaction.merchantLogoUrl ?? undefined}
            className="w-7 h-7 flex-shrink-0"
          />
        </div>
      </td>

      {/* Description */}
      <td className="px-3 py-2 bg-background dark:bg-background border-b border-gray-50 dark:border-gray-800">
        <div className="flex flex-col">
          <div className="font-medium text-foreground dark:text-foreground truncate flex items-center gap-2 text-xs">
            {transaction.description}
            {transaction.notes && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center ml-1" tabIndex={0}>
                    <StickyNote className="w-4 h-4 text-foreground dark:text-foreground flex-shrink-0" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs break-words">
                  {transaction.notes}
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
      <td className="px-3 py-2 bg-background dark:bg-background border-b border-gray-50 dark:border-gray-800">
        <div className="flex items-center justify-center">
          <CategoryIcon
            iconName={resolvedIconName}
            className="w-6 h-6 text-primary dark:text-primary"
          />
        </div>
      </td>

      {/* Account */}
      <td className="px-3 py-2 bg-background dark:bg-background border-b border-gray-50 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-muted dark:bg-muted flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground dark:bg-muted-foreground"></div>
          </div>
          <span className="text-xs text-foreground dark:text-foreground truncate">
            {transaction.accountName || 'Unknown Account'}
          </span>
        </div>
      </td>

      {/* Amount */}
      <td className="px-3 py-2 text-right bg-background dark:bg-background border-b border-gray-50 dark:border-gray-800">
        <div className="flex items-center justify-end gap-3">
          {(!transaction.categoryName ||
            transaction.categoryName === 'Uncategorized' ||
            transaction.categoryName === '') && (
            <Flag className="w-4 h-4 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
          )}
          <span className={`text-sm font-medium ${amountClassName} dark:text-chart-2`}>
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
