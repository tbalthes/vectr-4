'use client';

import React from 'react';
import { TableVirtuoso } from 'react-virtuoso';

import { TransactionRow } from './TransactionRow';

// CardNp and CardNpContent imports are not used in this component. Kept commented for future layout.
// import { CardNp, CardNpContent } from "@/components/ui/card-zero-pad";
import type { FormattedTransaction } from '@/types/transactions';
import type { DateHeader, GroupedTransactionItem } from '@/hooks/useInfiniteTransactions';

interface TransactionTableVirtuosoProps {
  transactions: GroupedTransactionItem[];
  className?: string;
  onEdit: (transaction: FormattedTransaction) => void;
  onDelete: (transaction: FormattedTransaction) => void;
  onUpdateNote?: (transactionId: string, note: string) => Promise<void>;
  loadMore?: () => void;
  isReachingEnd?: boolean;
  isLoading?: boolean;
  onOpenDetails?: (transactionId: string) => void;
}

// Helper function to check if item is a date header
const isDateHeader = (item: GroupedTransactionItem): item is DateHeader => {
  return (item as DateHeader).type === 'date-header';
};

// Date Header Component - returns cells for Virtuoso
const DateHeaderRow = ({ dateHeader }: { dateHeader: DateHeader }) => {
  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  };

  return (
    <>
      <td
        colSpan={5}
        className="px-4 py-2 bg-accent dark:bg-muted border-b border-gray-200 dark:border-gray-600 sticky top-0 z-10"
      >
        <div className="h-[7px] flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground dark:text-muted-foreground">
            {dateHeader.displayDate}
          </div>
          <div className="text-xs font-medium text-foreground dark:text-foreground">
            {formatAmount(dateHeader.dailyTotal ?? 0)}
          </div>
        </div>
      </td>
    </>
  );
};

export function TransactionTableVirtuoso({
  transactions,
  className,
  onEdit,
  onDelete,
  onUpdateNote,
  loadMore,
  isReachingEnd,
  isLoading,
  onOpenDetails,
}: TransactionTableVirtuosoProps) {
  console.log('TransactionTableVirtuoso render:', {
    transactionsCount: transactions.length,
    hasTransactions: transactions.length > 0,
    firstItem: transactions[0]
      ? isDateHeader(transactions[0])
        ? { id: transactions[0].id, type: 'date-header' }
        : { id: transactions[0].data.transactionId, type: 'transaction' }
      : null,
    isLoading,
    isReachingEnd,
    loadMore: !!loadMore,
    transactionsArray: transactions,
  });

  // Debug: Log when Virtuoso is being rendered
  console.log('Virtuoso: Rendering with', transactions.length, 'transactions');

  return (
    <div className={`h-full ${className}`}>
      <TableVirtuoso
        style={{ height: '100vh', minHeight: '600px' }}
        data={transactions}
        components={{
          Table: ({ style, ...props }) => (
            <table
              {...props}
              style={{
                ...style,
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
              }}
              className="min-w-full bg-background border-collapse"
            />
          ),
          TableHead: ({ style, ...props }) => (
            <thead
              {...props}
              style={style}
              className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border"
            />
          ),
          TableBody: ({ style, ...props }) => (
            <tbody {...props} style={style} className="bg-background" />
          ),
          TableRow: ({ style, ...props }) => (
            <tr
              {...props}
              style={style}
              className="group hover:bg-accent/30 dark:hover:bg-accent/20 transition-colors duration-200 border-b border-gray-50 dark:border-gray-800"
            />
          ),
        }}
        // fixedHeaderContent={() => (
        //   <tr className="bg-background">
        //     <th className="h-12 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-left w-[60px]">

        //     </th>
        //     <th className="h-12 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-left min-w-[300px]">
        //       DESCRIPTION
        //     </th>
        //     <th className="h-12 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-left w-[150px]">
        //       CATEGORY
        //     </th>
        //     <th className="h-12 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-left w-[150px]">
        //       ACCOUNT
        //     </th>
        //     <th className="h-12 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-left w-[120px]">
        //       AMOUNT
        //     </th>
        //     <th className="h-12 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-center w-[80px]">

        //     </th>
        //   </tr>
        // )}
        itemContent={(index, item) => {
          if (isDateHeader(item)) {
            console.log(`Rendering date header ${index}:`, item.displayDate);
            return <DateHeaderRow key={item.id ?? `date-header-${index}`} dateHeader={item} />;
          }

          // item is TransactionItem here (narrowed by isDateHeader above)
          const tx = item.data;
          console.log(`Rendering transaction ${index}:`, tx.description);
          return (
            <TransactionRow
              key={tx.transactionId}
              transaction={tx}
              onEdit={onEdit}
              onDelete={onDelete}
              onUpdateNote={onUpdateNote}
              onOpenDetails={onOpenDetails}
              index={index}
            />
          );
        }}
        endReached={() => {
          console.log('Virtuoso endReached called:', {
            hasLoadMore: !!loadMore,
            isReachingEnd,
            isLoading,
            currentTransactionCount: transactions.length,
          });

          if (loadMore && !isReachingEnd && !isLoading) {
            console.log('Virtuoso: Loading more transactions...');
            // Add 400ms delay before loading more transactions
            setTimeout(() => {
              console.log('Virtuoso: Calling loadMore after delay');
              loadMore();
            }, 400);
          } else {
            console.log('Virtuoso: Not loading more - conditions not met');
          }
        }}
        increaseViewportBy={200}
        overscan={5}
        totalCount={transactions.length}
      />

      {transactions.length === 0 && !isLoading && (
        <div className="flex justify-center py-8 text-muted-foreground">No transactions found</div>
      )}

      {isLoading && (
        <div className="flex justify-center py-4 text-muted-foreground">
          Loading more transactions...
        </div>
      )}

      {!isLoading && isReachingEnd && transactions.length > 0 && (
        <div className="flex justify-center py-4 text-muted-foreground">
          All transactions loaded ({transactions.length} total)
        </div>
      )}
    </div>
  );
}

export default TransactionTableVirtuoso;
