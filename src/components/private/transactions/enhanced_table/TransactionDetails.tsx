import { FileText, Trash2, Hash, Clock, StickyNote, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Transaction } from "@/data/transaction-table";

interface TransactionDetailsProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
}

export function TransactionDetails({
  transaction,
  onEdit,
  onDelete,
}: TransactionDetailsProps) {
  return (
    <div className="bg-muted/10 border-t border-border/50 py-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-6">
        {/* Left Column - Transaction Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Transaction Details
            </span>
          </div>

          <div className="space-y-3 pl-6">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Transaction Number
              </div>
              <div className="font-mono text-sm text-foreground">
                {transaction.transaction_number}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Original Description
              </div>
              <div className="text-sm text-foreground bg-background border border-border rounded-lg p-2 font-mono">
                {transaction.original_description}
              </div>
            </div>

            {transaction.note && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <StickyNote className="w-3 h-3" />
                  Note
                </div>
                <div className="text-sm text-chart-3 italic bg-chart-3/5 border border-chart-3/20 rounded-lg p-2">
                  {transaction.note}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Categories & Metadata */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Categories & Metadata
            </span>
          </div>

          <div className="space-y-3 pl-6">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                All Categories
              </div>
              <div className="flex flex-wrap gap-1">
                {transaction.categories.map((category, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="text-xs bg-primary/5 text-primary border-primary/20"
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            </div>

            {transaction.user_metadata && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Custom Fields
                </div>
                <div className="space-y-2">
                  {transaction.user_metadata.field1 && (
                    <div className="flex items-center justify-between text-sm bg-chart-4/10 border border-chart-4/20 rounded-lg p-2">
                      <span className="font-medium text-chart-4">
                        {transaction.user_metadata.field1.label}:
                      </span>
                      <span className="text-foreground">
                        {transaction.user_metadata.field1.value}
                      </span>
                    </div>
                  )}
                  {transaction.user_metadata.field2 && (
                    <div className="flex items-center justify-between text-sm bg-chart-5/10 border border-chart-5/20 rounded-lg p-2">
                      <span className="font-medium text-chart-5">
                        {transaction.user_metadata.field2.label}:
                      </span>
                      <span className="text-foreground">
                        {transaction.user_metadata.field2.value}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Separator className="my-4" />

      {/* Actions */}
      <div className="flex items-center justify-between px-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>
            Last updated: {new Date(transaction.date).toLocaleDateString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(transaction)}
            className="h-8"
          >
            <FileText className="w-4 h-4 mr-2" />
            Edit Details
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(transaction)}
            className="h-8"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
