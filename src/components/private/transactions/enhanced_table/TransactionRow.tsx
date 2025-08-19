import { useState } from "react";
import {
  Edit3,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CategoryIcon } from "./CategoryIcon";
import { MerchantLogo } from "./MerchantLogo";
import { TransactionDetails } from "./TransactionDetails";
import { Transaction } from "@/data/transaction-table";

interface TransactionRowProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  isSelected: boolean;
  index: number;
}

export function TransactionRow({
  transaction,
  onEdit,
  onDelete,
  isSelected,
  index,
}: TransactionRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatAmount = (amount: number) => {
    const isIncome = amount > 0;
    const formattedAmount = Math.abs(amount).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

    return {
      amount: formattedAmount,
      isIncome,
      className: isIncome
        ? "text-chart-2 font-semibold"
        : "text-foreground font-semibold",
    };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      main: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      year: date.getFullYear().toString().slice(-2),
    };
  };

  const {
    amount,
    isIncome,
    className: amountClassName,
  } = formatAmount(transaction.amount);
  const dateFormatted = formatDate(transaction.date);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <TableRow
        className={`group hover:bg-accent/30 transition-all duration-200 border-b border-border/50 ${
          isSelected ? "bg-accent/50" : ""
        } ${index % 2 === 0 ? "bg-background" : "bg-muted/20"} ${
          transaction.needs_review ? "border-l-4 border-l-chart-1" : ""
        }`}
      >
        {/* Date */}
        <TableCell className="px-6 py-4">
          <div className="text-center">
            <div className="text-sm font-medium text-foreground">
              {dateFormatted.main}
            </div>
            <div className="text-xs text-muted-foreground">
              {dateFormatted.year}
            </div>
          </div>
        </TableCell>

        {/* Description */}
        <TableCell className="px-6 py-4">
          <div className="flex items-center gap-3">
            <MerchantLogo
              merchant={transaction.clean_description}
              logoUrl={transaction.merchantLogo}
              className="w-8 h-8 flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground truncate">
                {transaction.clean_description}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {transaction.category}
              </div>
              {transaction.needs_review && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3 text-chart-1" />
                  <span className="text-xs text-chart-1 font-medium">
                    Needs Review
                  </span>
                </div>
              )}
            </div>
          </div>
        </TableCell>

        {/* Amount */}
        <TableCell className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            {isIncome ? (
              <ArrowUpRight className="w-4 h-4 text-chart-2 flex-shrink-0" />
            ) : (
              <ArrowDownLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            <span className={`text-lg ${amountClassName}`}>
              {isIncome ? "+" : ""}
              {amount}
            </span>
          </div>
        </TableCell>

        {/* Category Icon */}
        <TableCell className="px-6 py-4">
          <div className="flex items-center justify-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 border border-primary/20">
              <CategoryIcon
                category={transaction.mainCategory}
                className="w-5 h-5 text-primary"
              />
            </div>
          </div>
        </TableCell>

        {/* Status */}
        <TableCell className="px-6 py-4 text-center">
          {transaction.needs_review ? (
            <Badge
              variant="destructive"
              className="text-xs bg-chart-1/20 text-chart-1 border-chart-1/30"
            >
              Review
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="text-xs bg-chart-2/20 text-chart-2 border-chart-2/30"
            >
              Verified
            </Badge>
          )}
        </TableCell>

        {/* Details Toggle */}
        <TableCell className="px-6 py-4">
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-60 group-hover:opacity-100 transition-opacity duration-200 hover:bg-primary/10 hover:text-primary"
              onClick={() => onEdit(transaction)}
            >
              <Edit3 className="w-4 h-4" />
            </Button>

            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 opacity-60 group-hover:opacity-100 transition-all duration-200 hover:bg-accent"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </TableCell>
      </TableRow>

      <CollapsibleContent asChild>
        <TableRow className="border-b-0">
          <TableCell colSpan={6} className="p-0">
            <TransactionDetails
              transaction={transaction}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}
