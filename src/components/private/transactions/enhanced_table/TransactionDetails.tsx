"use client";

import { useState, useEffect } from "react";
import { Hash, StickyNote, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
// Step 1: Import the new, flattened transaction type
import { FormattedTransaction } from "@/types/transactions";

interface TransactionDetailsProps {
  transaction: FormattedTransaction;
  onUpdateNote?: (transactionId: string, note: string) => Promise<void>;
}

export function TransactionDetails({ transaction, onUpdateNote }: TransactionDetailsProps) {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(transaction.note || "");
  const [isSaving, setIsSaving] = useState(false);

  // Keep local noteValue in sync if parent updates the transaction prop
  useEffect(() => {
    setNoteValue(transaction.note || "");
  }, [transaction.note]);

  // Save on blur: if the note changed, call the parent update handler.
  const handleBlurSave = async () => {
    if (!onUpdateNote) {
      setIsEditingNote(false);
      return;
    }

    // If nothing changed, just close editor.
    if ((transaction.note || "") === noteValue) {
      setIsEditingNote(false);
      return;
    }

    setIsSaving(true);
    try {
      // Trim here: empty string means delete the note per UX
      await onUpdateNote(transaction.id, noteValue.trim());
    } catch (error) {
      console.error("Failed to save note:", error);
      // Revert to original on error
      setNoteValue(transaction.note || "");
    } finally {
      setIsSaving(false);
      setIsEditingNote(false);
    }
  };
  // Step 2: Handle category display dynamically.
  // If the transaction has multiple categories, use them. Otherwise, use the single main category.
  const categoriesToShow = transaction.allCategories || [
    transaction.categoryName,
  ];

  return (
    <div className="border-t border-border/30 py-2">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 px-3">
        {/* Left Column - Transaction Details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Transaction Details
            </span>
          </div>

          <div className="space-y-2 pl-6">
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
              <div className="text-sm text-foreground bg-background border border-border rounded-lg p-2 font-mono break-all max-w-full overflow-x-auto whitespace-nowrap">
                {/* Step 3: Use camelCase prop */}
                {transaction.originalDescription}
              </div>
            </div>

            {/* Notes Field - Always show, editable */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <StickyNote className="w-3 h-3" />
                Notes
              </div>
              {isEditingNote ? (
                <div>
                  <Textarea
                    value={noteValue}
                    onChange={(e) => setNoteValue(e.target.value)}
                    placeholder="Add a note for this transaction..."
                    className="text-sm min-h-[60px] resize-none"
                    onBlur={() => handleBlurSave()}
                    disabled={isSaving}
                    autoFocus
                  />
                </div>
              ) : (
                <div
                  className={`text-sm text-foreground bg-background border border-border rounded-lg p-2 cursor-pointer hover:bg-muted/20 transition-colors min-h-[40px] flex items-center ${isSaving ? 'opacity-60 pointer-events-none' : ''}`}
                  onClick={() => setIsEditingNote(true)}
                >
                  {noteValue ? (
                    <span className="text-chart-3 italic">{noteValue}</span>
                  ) : (
                    <span className="text-muted-foreground italic">Click to add a note...</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Categories & Metadata */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Categories & Metadata
            </span>
          </div>

          <div className="space-y-2 pl-6">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
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
                  <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <span>Custom Fields</span>
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {Object.keys(transaction.userMetadata).length}
                    </span>
                  </div>
                  <div className="space-y-1">
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
                          <div key={key} className="mb-1">
                            <div className="text-xs font-medium text-muted-foreground mb-1">
                              {key.replace(/_/g, " ").replace(/([A-Z])/g, ' $1').trim()}:
                            </div>
                            <div className="text-sm text-foreground bg-background border border-border rounded-lg p-2 font-mono break-all max-w-full overflow-x-auto whitespace-nowrap">
                              {String(value)}
                            </div>
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

  {/* Actions and Transaction Date removed for cleaner details row */}
    </div>
  );
}
