"use client";

import { FileText, Trash2, Hash, Clock, StickyNote, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
// Step 1: Import the new, flattened transaction type
import { FormattedTransaction } from "@/types/transactions";

interface TransactionDetailsProps {
  transaction: FormattedTransaction;
  onEdit: (transaction: FormattedTransaction) => void;
  onDelete: (transaction: FormattedTransaction) => void;
}

export function TransactionDetails({
  transaction,
  onEdit,
  onDelete,
}: TransactionDetailsProps) {
  // Step 2: Handle category display dynamically.
  // If the transaction has multiple categories, use them. Otherwise, use the single main category.
  const categoriesToShow = transaction.allCategories || [
    transaction.categoryName,
  ];

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
              <div className="text-sm text-foreground bg-background border border-border rounded-lg p-2 font-mono break-all">
                {/* Step 3: Use camelCase prop */}
                {transaction.originalDescription}
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
                Categories
              </div>
              <div className="flex flex-wrap gap-1">
                {categoriesToShow.map((category, index) => (
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

            {/* Dynamically render User Metadata / Custom Fields */}
            {transaction.userMetadata &&
              typeof transaction.userMetadata === 'object' &&
              transaction.userMetadata !== null &&
              Object.keys(transaction.userMetadata).length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <span>Custom Fields</span>
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {Object.keys(transaction.userMetadata).length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(transaction.userMetadata).map(
                      ([key, value]) => {
                        // Skip internal fields like _rowIndex, formattedAmount, and other system fields
                        const isSystemField = key.startsWith('_') ||
                                             key.toLowerCase().includes('rowindex') ||
                                             key.toLowerCase().includes('formattedamount') ||
                                             key.toLowerCase().includes('index');
                        
                        if (isSystemField ||
                            value === null ||
                            value === undefined ||
                            value === '' ||
                            typeof value === 'object') {
                          return null;
                        }
                        
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between text-sm bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 hover:from-blue-100 hover:to-indigo-100 transition-colors"
                          >
                            <span className="font-medium text-blue-700 capitalize">
                              {key.replace(/_/g, " ").replace(/([A-Z])/g, ' $1').trim()}:
                            </span>
                            <span className="text-slate-700 font-mono text-sm bg-white px-2 py-1 rounded border">
                              {String(value)}
                            </span>
                          </div>
                        );
                      }
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
            Transaction Date: {new Date(transaction.date).toLocaleDateString()}
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
            Edit
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
