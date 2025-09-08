"use client";
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Plus,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Landmark,
  Building,
} from "lucide-react";
import { accountToasts } from "@/lib/notifications/account-notifications";

interface ManualAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountConnected: () => void;
}

interface ManualAccountForm {
  institutionName: string;
  accountName: string;
  accountType: "depository" | "credit" | "loan" | "investment" | "other";
  accountSubtype: string;
  mask: string;
  currency: string;
  initialBalance: string;
}

export function ManualAccountModal({
  open,
  onOpenChange,
  onAccountConnected,
}: ManualAccountModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState<ManualAccountForm>({
    institutionName: "",
    accountName: "",
    accountType: "depository",
    accountSubtype: "",
    mask: "",
    currency: "USD",
    initialBalance: "",
  });

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Create institution
      const institutionResponse = await fetch("/api/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "manual",
          name: manualForm.institutionName,
        }),
      });

      let institution;
      if (institutionResponse.status === 409) {
        // Institution already exists, use the existing one
        const conflictData = await institutionResponse.json();
        institution = conflictData.existing;
      } else if (institutionResponse.ok) {
        institution = await institutionResponse.json();
      } else {
        throw new Error("Failed to create institution");
      }

      // Create account
      const accountResponse = await fetch("/api/accounts/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institution_id: institution.id,
          name: manualForm.accountName,
          type: manualForm.accountType,
          subtype: manualForm.accountSubtype || null,
          mask: manualForm.mask || null,
          currency: manualForm.currency,
          initial_balance: parseFloat(manualForm.initialBalance) || 0,
        }),
      });

      if (!accountResponse.ok) throw new Error("Failed to create account");

      // Clear any existing notifications and show success
      accountToasts.clearAll();
      accountToasts.connected(
        manualForm.accountName,
        "Account added successfully!"
      );

      // Reset form
      setManualForm({
        institutionName: "",
        accountName: "",
        accountType: "depository",
        accountSubtype: "",
        mask: "",
        currency: "USD",
        initialBalance: "",
      });

      onOpenChange(false);
      onAccountConnected();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to add account";
      setError(errorMessage);
      accountToasts.syncError("manual account", errorMessage, true);
    } finally {
      setLoading(false);
    }
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case "depository":
        return <PiggyBank className="h-5 w-5" />;
      case "credit":
        return <CreditCard className="h-5 w-5" />;
      case "investment":
        return <TrendingUp className="h-5 w-5" />;
      case "loan":
        return <Landmark className="h-5 w-5" />;
      default:
        return <Building className="h-5 w-5" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Add Manual Account</span>
          </DialogTitle>
          <DialogDescription>
            Enter account details manually for tracking
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleManualSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="institutionName">Bank/Institution Name</Label>
            <Input
              id="institutionName"
              value={manualForm.institutionName}
              onChange={(e) =>
                setManualForm({ ...manualForm, institutionName: e.target.value })
              }
              placeholder="e.g., Chase, Wells Fargo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountName">Account Name</Label>
            <Input
              id="accountName"
              value={manualForm.accountName}
              onChange={(e) =>
                setManualForm({ ...manualForm, accountName: e.target.value })
              }
              placeholder="e.g., Main Checking, Savings"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accountType">Account Type</Label>
              <Select
                value={manualForm.accountType}
                onValueChange={(value: typeof manualForm.accountType) =>
                  setManualForm({ ...manualForm, accountType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="depository">
                    <div className="flex items-center space-x-2">
                      {getAccountTypeIcon("depository")}
                      <span>Depository</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="credit">
                    <div className="flex items-center space-x-2">
                      {getAccountTypeIcon("credit")}
                      <span>Credit</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="investment">
                    <div className="flex items-center space-x-2">
                      {getAccountTypeIcon("investment")}
                      <span>Investment</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="loan">
                    <div className="flex items-center space-x-2">
                      {getAccountTypeIcon("loan")}
                      <span>Loan</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="other">
                    <div className="flex items-center space-x-2">
                      {getAccountTypeIcon("other")}
                      <span>Other</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountSubtype">Subtype (Optional)</Label>
              <Input
                id="accountSubtype"
                value={manualForm.accountSubtype}
                onChange={(e) =>
                  setManualForm({ ...manualForm, accountSubtype: e.target.value })
                }
                placeholder="e.g., checking, savings"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mask">Account Mask (Optional)</Label>
              <Input
                id="mask"
                value={manualForm.mask}
                onChange={(e) =>
                  setManualForm({ ...manualForm, mask: e.target.value })
                }
                placeholder="e.g., 1234"
                maxLength={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={manualForm.currency}
                onValueChange={(value) =>
                  setManualForm({ ...manualForm, currency: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="initialBalance">Initial Balance (Optional)</Label>
            <Input
              id="initialBalance"
              type="number"
              step="0.01"
              value={manualForm.initialBalance}
              onChange={(e) =>
                setManualForm({ ...manualForm, initialBalance: e.target.value })
              }
              placeholder="0.00"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Adding..." : "Add Account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
