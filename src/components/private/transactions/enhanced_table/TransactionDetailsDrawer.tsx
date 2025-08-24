"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  X,
  Calendar as CalendarIcon,
  FileText,
  Tag,
  DollarSign,
  StickyNote,
  Building2,
  AlertTriangle,
  Hash,
  Receipt,
  Edit3,
  Trash2,
  RotateCcw
} from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import CategoryIcon from "./CategoryIcon";
import MerchantLogo from "./MerchantLogo";

interface DetailedTransaction {
  id: string;
  transaction_number: string;
  date: string;
  clean_description: string;
  original_description: string;
  amount: number;
  balance: number | null;
  user_metadata: Record<string, string | number | boolean> | null;
  needs_review: boolean;
  transaction_note: string | null;
  merchant_name: string;
  merchant_logo_url: string | null;
  category_name: string;
  category_icon: string;
  parent_category_name: string | null;
  custom_fields: Record<string, string | number | boolean>;
}

interface TransactionDetailsDrawerProps {
  transactionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (transaction: DetailedTransaction) => void;
  onDelete?: (transactionId: string) => void;
}

export function TransactionDetailsDrawer({
  transactionId,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: TransactionDetailsDrawerProps) {
  const [transaction, setTransaction] = useState<DetailedTransaction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTransaction, setEditedTransaction] = useState<DetailedTransaction | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (transactionId && isOpen) {
      fetchTransactionDetails();
    }
  }, [transactionId, isOpen]);

  const fetchTransactionDetails = async () => {
    if (!transactionId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/transactions/${transactionId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch transaction: ${response.statusText}`);
      }

      const data = await response.json();
      setTransaction(data.data);
      setEditedTransaction(data.data);
    } catch (err) {
      console.error("Error fetching transaction details:", err);
      setError(err instanceof Error ? err.message : "Failed to load transaction details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditedTransaction(transaction);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (transaction && onDelete) {
      onDelete(transaction.id);
      onClose();
    }
  };

  const updateEditedField = (field: keyof DetailedTransaction, value: string | number | null) => {
    if (editedTransaction) {
      const updatedTransaction = {
        ...editedTransaction,
        [field]: value
      };
      setEditedTransaction(updatedTransaction);
      
      // Auto-save on field change
      if (onEdit) {
        onEdit(updatedTransaction);
        setTransaction(updatedTransaction);
      }
    }
  };

  const formatAmount = (amount: number) => {
    const isCredit = amount > 0;
    const formattedAmount = Math.abs(amount).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

    return {
      amount: formattedAmount,
      isCredit,
      display: `${isCredit ? "+" : ""}${formattedAmount}`,
    };
  };

  const formatBalance = (balance: number) => {
    const formattedBalance = Math.abs(balance).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

    return balance < 0 ? `-${formattedBalance}` : formattedBalance;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatFieldName = (key: string) => {
    return key
      .replace(/_/g, " ")
      .replace(/([A-Z])/g, " $1")
      .trim()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (!isOpen) return null;

  const currentTransaction = isEditing ? editedTransaction : transaction;

  return (
    <Drawer open={isOpen} onOpenChange={onClose} direction="right">
      <DrawerContent className="w-96 sm:w-[500px] border-l">
        {/* Header with action buttons */}
        <DrawerHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-lg font-semibold">
              {isEditing ? "Edit Transaction" : "Transaction Details"}
            </DrawerTitle>
            <div className="flex items-center gap-2">
              {!isEditing && transaction && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleEdit}
                    className="h-8 w-8"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </div>
          {currentTransaction?.needs_review && (
            <Badge variant="outline" className="w-fit mt-2 text-amber-600 border-amber-300">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Needs Review
            </Badge>
          )}
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <p className="text-sm font-medium text-destructive">Error loading transaction</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          )}

          {currentTransaction && (
            <div className="p-6 space-y-6">
              {/* Amount - Most important, gets prominence */}
              <div className="text-center py-4">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Amount
                </div>
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={currentTransaction.amount}
                    onChange={(e) => updateEditedField('amount', parseFloat(e.target.value) || 0)}
                    onBlur={(e) => updateEditedField('amount', parseFloat(e.target.value) || 0)}
                    className="text-center text-2xl font-light h-auto py-2"
                  />
                ) : (
                  <div className={cn(
                    "text-3xl font-light",
                    currentTransaction.amount > 0 ? "text-emerald-600" : "text-foreground"
                  )}>
                    {formatAmount(currentTransaction.amount).display}
                  </div>
                )}
              </div>

              {/* Key details in clean rows */}
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Date</span>
                  {isEditing ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-auto text-sm justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {currentTransaction.date ? format(new Date(currentTransaction.date), "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={new Date(currentTransaction.date)}
                          onSelect={(date) => {
                            if (date) {
                              updateEditedField('date', date.toISOString().split('T')[0]);
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <span className="text-sm font-medium">{formatDate(currentTransaction.date)}</span>
                  )}
                </div>

                <div className="flex justify-between items-center py-3 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Transaction #</span>
                  {isEditing ? (
                    <Input
                      value={currentTransaction.transaction_number}
                      onChange={(e) => updateEditedField('transaction_number', e.target.value)}
                      onBlur={(e) => updateEditedField('transaction_number', e.target.value)}
                      className="w-32 text-sm font-mono text-right"
                    />
                  ) : (
                    <span className="text-sm font-mono">{parseInt(currentTransaction.transaction_number, 10)}</span>
                  )}
                </div>

                {currentTransaction.balance !== null && (
                  <div className="flex justify-between items-center py-3 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Balance</span>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={currentTransaction.balance || 0}
                        onChange={(e) => updateEditedField('balance', parseFloat(e.target.value) || 0)}
                        onBlur={(e) => updateEditedField('balance', parseFloat(e.target.value) || 0)}
                        className="w-32 text-sm text-right"
                      />
                    ) : (
                      <span className="text-sm font-medium">{formatBalance(currentTransaction.balance)}</span>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-start py-3 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Merchant</span>
                  {isEditing ? (
                    <Input
                      value={currentTransaction.merchant_name}
                      onChange={(e) => updateEditedField('merchant_name', e.target.value)}
                      onBlur={(e) => updateEditedField('merchant_name', e.target.value)}
                      className="w-48 text-sm text-right"
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-right">
                      <MerchantLogo
                        merchantName={currentTransaction.merchant_name}
                        logoUrl={currentTransaction.merchant_logo_url}
                        className="w-5 h-5"
                      />
                      <span className="text-sm font-medium">{currentTransaction.merchant_name}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-start py-3 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Category</span>
                  {isEditing ? (
                    <Input
                      value={currentTransaction.category_name}
                      onChange={(e) => updateEditedField('category_name', e.target.value)}
                      onBlur={(e) => updateEditedField('category_name', e.target.value)}
                      className="w-48 text-sm text-right"
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-right">
                      <CategoryIcon
                        iconName={currentTransaction.category_icon}
                        className="w-4 h-4 text-muted-foreground"
                      />
                      <div className="text-sm">
                        {currentTransaction.parent_category_name ? (
                          <span className="text-muted-foreground">
                            {currentTransaction.parent_category_name} → {currentTransaction.category_name}
                          </span>
                        ) : (
                          <span className="font-medium">{currentTransaction.category_name}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Original description */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Original Description
                </div>
                {isEditing ? (
                  <Textarea
                    value={currentTransaction.original_description}
                    onChange={(e) => updateEditedField('original_description', e.target.value)}
                    onBlur={(e) => updateEditedField('original_description', e.target.value)}
                    className="text-sm font-mono resize-none"
                    rows={3}
                  />
                ) : (
                  <div className="text-sm bg-muted/30 rounded-md p-3 font-mono text-muted-foreground">
                    {currentTransaction.original_description}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Notes
                </div>
                {isEditing ? (
                  <Textarea
                    value={currentTransaction.transaction_note || ''}
                    onChange={(e) => updateEditedField('transaction_note', e.target.value || null)}
                    onBlur={(e) => updateEditedField('transaction_note', e.target.value || null)}
                    placeholder="Add a note..."
                    className="text-sm resize-none"
                    rows={2}
                  />
                ) : currentTransaction.transaction_note ? (
                  <div className="text-sm bg-muted/30 rounded-md p-3 italic">
                    {currentTransaction.transaction_note}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">No notes</div>
                )}
              </div>

              {/* Custom fields if present */}
              {Object.keys(currentTransaction.custom_fields).length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Additional Fields
                  </div>
                  <div className="space-y-2">
                    {Object.entries(currentTransaction.custom_fields).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center py-2 text-sm">
                        <span className="text-muted-foreground">{formatFieldName(key)}</span>
                        <span className="font-mono text-right">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Save and Cancel buttons at bottom when editing */}
              {isEditing && (
                <div className="pt-4 border-t space-y-2">
                  <Button
                    onClick={() => setIsEditing(false)}
                    className="w-full"
                  >
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    className="w-full"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Cancel Changes
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-background border rounded-lg p-6 max-w-sm mx-4 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-destructive/10 rounded-full">
                  <Trash2 className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold">Delete Transaction</h3>
                  <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}