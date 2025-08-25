"use client";

import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Edit,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  StickyNote,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { FormattedTransaction } from "@/types/transactions";

interface TransactionTableProps {
  transactions: FormattedTransaction[];
  allCount: number;
}

// Helper that checks multiple possible note fields safely
const hasTransactionNote = (t: FormattedTransaction) => {
  if (t.note) return true;
  const u = t as unknown as Record<string, unknown>;
  if (
    Object.prototype.hasOwnProperty.call(u, "transaction_note") &&
    typeof u["transaction_note"] === "string"
  )
    return true;
  if (
    Object.prototype.hasOwnProperty.call(u, "transactionNote") &&
    typeof u["transactionNote"] === "string"
  )
    return true;
  return false;
};

const getTransactionNote = (t: FormattedTransaction): string | undefined => {
  if (typeof t.note === "string" && t.note.length > 0) return t.note;
  const u = t as unknown as Record<string, unknown>;
  if (
    Object.prototype.hasOwnProperty.call(u, "transaction_note") &&
    typeof u["transaction_note"] === "string"
  )
    return u["transaction_note"] as string;
  if (
    Object.prototype.hasOwnProperty.call(u, "transactionNote") &&
    typeof u["transactionNote"] === "string"
  )
    return u["transactionNote"] as string;
  return undefined;
};

export default function TransactionTable({
  transactions,
  allCount,
}: TransactionTableProps) {
  // Determine color classes based on transaction type
  const getTransactionColorClasses = (type: string) => {
    if (type === "income") {
      return {
        bg: "bg-success/10",
        text: "text-success",
        icon: "text-success",
      };
    } else {
      return {
        bg: "bg-destructive/10",
        text: "text-destructive",
        icon: "text-destructive",
      };
    }
  };

  return (
    <Card className="card-clean">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">
              All Transactions
            </CardTitle>
            <CardDescription>
              {transactions.length} of {allCount} transactions
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border-light">
          {transactions.map((transaction) => {
            const colorClasses = getTransactionColorClasses(transaction.type);
            return (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 hover:bg-muted/30 transition-smooth"
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses.bg} ${colorClasses.text}`}
                  >
                    {transaction.type === "income" ? (
                      <ArrowUpRight
                        className={`h-4 w-4 ${colorClasses.icon}`}
                      />
                    ) : (
                      <ArrowDownRight
                        className={`h-4 w-4 ${colorClasses.icon}`}
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {transaction.description}
                      {hasTransactionNote(transaction) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="inline-flex items-center ml-2"
                              tabIndex={0}
                            >
                              <StickyNote className="w-4 h-4 text-muted-foreground inline-block" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="max-w-xs break-words"
                          >
                            {getTransactionNote(transaction)}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </p>
                    <div className="flex items-center space-x-3 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {transaction.category}
                      </Badge>
                      <span className="text-xs text-muted">
                        {transaction.account}
                      </span>
                      <span className="text-xs text-muted">
                        {transaction.date}
                      </span>
                      <Badge
                        variant={
                          transaction.status === "completed"
                            ? "default"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {transaction.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span
                    className={`text-sm font-semibold ${
                      transaction.amount > 0
                        ? "text-success"
                        : "text-foreground"
                    }`}
                  >
                    {transaction.amount > 0 ? "+" : ""}$
                    {Math.abs(transaction.amount).toFixed(2)}
                  </span>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {transactions.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted">
              No transactions found matching your criteria.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
