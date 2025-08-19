import { useState } from "react";
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
import { TransactionRow } from "./TransactionRow";
import {
  Transaction,
  mockTransactions,
} from "@/data/transaction-table";

interface TransactionTableProps {
  transactions?: Transaction[];
  title?: string;
  className?: string;
}

export function TransactionTable({
  transactions = mockTransactions,
  title = "Transaction History",
  className,
}: TransactionTableProps) {
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);

  const handleEditTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    console.log("Edit transaction:", transaction);
  };

  const handleDeleteTransaction = (transaction: Transaction) => {
    console.log("Delete transaction:", transaction);
  };

  const reviewCount = transactions.filter((t) => t.needs_review).length;

  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-6 border-b border-primary/10 bg-gradient-to-r from-primary/5 to-chart-2/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl text-foreground">
                {title}
              </CardTitle>
              <p className="text-sm text-primary mt-1">
                Manage and track your financial transactions
              </p>
            </div>
            <div className="flex items-center gap-3">
              {reviewCount > 0 && (
                <Badge
                  variant="destructive"
                  className="text-xs bg-chart-1/20 text-chart-1 border-chart-1/30 hover:bg-chart-1/30"
                >
                  {reviewCount} need review
                </Badge>
              )}
              <div className="text-sm text-chart-3 font-medium bg-chart-3/10 px-3 py-1 rounded-lg border border-chart-3/20">
                {transactions.length} transactions
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-[700px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/50 border-b border-border">
                  <TableHead className="h-12 px-6 text-xs uppercase tracking-wider font-medium text-muted-foreground w-[120px]">
                    Date
                  </TableHead>
                  <TableHead className="h-12 px-6 text-xs uppercase tracking-wider font-medium text-muted-foreground">
                    Description
                  </TableHead>
                  <TableHead className="h-12 px-6 text-xs uppercase tracking-wider font-medium text-muted-foreground text-right w-[140px]">
                    Amount
                  </TableHead>
                  <TableHead className="h-12 px-6 text-xs uppercase tracking-wider font-medium text-muted-foreground text-center w-[80px]">
                    Category
                  </TableHead>
                  <TableHead className="h-12 px-6 text-xs uppercase tracking-wider font-medium text-muted-foreground text-center w-[100px]">
                    Status
                  </TableHead>
                  <TableHead className="h-12 px-6 text-xs uppercase tracking-wider font-medium text-muted-foreground text-center w-[60px]">
                    Details
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction, index) => (
                  <TransactionRow
                    key={transaction.transaction_number}
                    transaction={transaction}
                    onEdit={handleEditTransaction}
                    onDelete={handleDeleteTransaction}
                    isSelected={
                      selectedTransaction?.transaction_number ===
                      transaction.transaction_number
                    }
                    index={index}
                  />
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
