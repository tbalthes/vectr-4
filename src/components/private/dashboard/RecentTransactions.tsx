import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, MoreHorizontal } from "lucide-react";

interface Transaction {
  id: number;
  description: string;
  amount: number;
  category: string;
  date: string;
  type: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
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
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">
              Recent Transactions
            </CardTitle>
            <CardDescription>Your latest financial activity</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            View all
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.map((transaction) => {
            const colorClasses = getTransactionColorClasses(transaction.type);
            return (
              <div
                key={transaction.id}
                className="flex items-center justify-between py-3 border-b border-border-light last:border-0"
              >
                <div className="flex items-center space-x-3">
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
                    </p>
                    <p className="text-xs text-muted">
                      {transaction.category} • {transaction.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
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
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
