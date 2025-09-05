"use client";
import React, { useState } from "react";
import { usePlaidLink } from "react-plaid-link";
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
  CheckCircle,
  Building,
  Plus,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Landmark,
} from "lucide-react";
import { accountToasts } from "@/lib/notifications/account-notifications";
import { useAccountSync } from "@/contexts/AccountSyncContext";

interface ConnectAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountConnected: () => void;
}

type ModalView = "main" | "plaid" | "manual";

interface ManualAccountForm {
  institutionName: string;
  accountName: string;
  accountType: "depository" | "credit" | "loan" | "investment" | "other";
  accountSubtype: string;
  mask: string;
  currency: string;
  initialBalance: string;
}

export function ConnectAccountModal({
  open,
  onOpenChange,
  onAccountConnected,
}: ConnectAccountModalProps) {
  const [view, setView] = useState<ModalView>("main");
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [manualForm, setManualForm] = useState<ManualAccountForm>({
    institutionName: "",
    accountName: "",
    accountType: "depository",
    accountSubtype: "",
    mask: "",
    currency: "USD",
    initialBalance: "",
  });

  const {
    startAccountSync,
    updateAccountSync,
    completeAccountSync,
    errorAccountSync,
  } = useAccountSync();

  // Fetch link token when switching to Plaid view
  React.useEffect(() => {
    if (view === "plaid" && !linkToken && !loading) {
      fetchLinkToken();
    }
  }, [view, linkToken, loading]);

  const fetchLinkToken = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Fetching link token...");
      const response = await fetch("/api/aggregator/plaid/create_link_token", {
        method: "POST",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to create link token: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (err) {
      console.error("Error fetching link token:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create link token";
      setError(errorMessage);
      accountToasts.syncError("account connection", errorMessage, true);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaidSuccess = async (public_token: string) => {
    setLoading(true);
    setError(null);

    startAccountSync({
      accountName: "New Account",
      step: 1,
      totalSteps: 3,
      currentOperation: "Exchanging secure token...",
      estimatedTime: "30 seconds",
    });

    try {
      updateAccountSync({
        accountName: "New Account",
        step: 2,
        totalSteps: 3,
        currentOperation: "Fetching account details...",
        estimatedTime: "15 seconds",
      });

      const response = await fetch(
        "/api/aggregator/plaid/exchange_public_token",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token }),
        }
      );

      if (!response.ok) throw new Error("Failed to exchange token");
      const result = await response.json();

      updateAccountSync({
        accountName: "New Account",
        step: 3,
        totalSteps: 3,
        currentOperation: "Setting up account...",
        estimatedTime: "5 seconds",
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Clear any existing notifications before showing success
      accountToasts.clearAll();

      completeAccountSync(result.accountName || "New Account", 0);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setLinkToken(null);
        setView("main");
        onAccountConnected();
      }, 2000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to connect account";
      setError(errorMessage);
      errorAccountSync("New Account", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaidExit = () => {
    setLoading(false);
    setView("main");
  };

  const { open: openPlaidLink, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: handlePlaidExit,
  });

  const handleConnectClick = () => {
    if (linkToken && ready) {
      accountToasts.connectionWarning(1, "1-2 minutes");
      setTimeout(() => openPlaidLink(), 1000);
    }
  };

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

      setManualForm({
        institutionName: "",
        accountName: "",
        accountType: "depository",
        accountSubtype: "",
        mask: "",
        currency: "USD",
        initialBalance: "",
      });

      setView("main");
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

  const renderMainView = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">
          How would you like to connect?
        </h3>
        <p className="text-sm text-muted-foreground">
          Choose your preferred method to add accounts
        </p>
      </div>

      <div className="space-y-3">
        <Button
          onClick={() => setView("plaid")}
          className="w-full h-auto p-4 flex items-center justify-start space-x-3 bg-blue-600 hover:bg-blue-700"
        >
          <Building className="h-6 w-6" />
          <div className="text-left">
            <div className="font-semibold">Connect with Plaid</div>
            <div className="text-sm opacity-90">
              Link your bank account securely
            </div>
          </div>
        </Button>

        <Button
          onClick={() => setView("manual")}
          variant="outline"
          className="w-full h-auto p-4 flex items-center justify-start space-x-3"
        >
          <Plus className="h-6 w-6" />
          <div className="text-left">
            <div className="font-semibold">Add manual account</div>
            <div className="text-sm text-muted-foreground">
              Enter account details manually
            </div>
          </div>
        </Button>
      </div>
    </div>
  );

  const renderPlaidView = () => (
    <div className="space-y-4">
      <Button
        variant="ghost"
        onClick={() => setView("main")}
        className="p-0 h-auto text-sm text-muted-foreground"
      >
        ← Back to options
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Account connected successfully! Setting up your data...
          </AlertDescription>
        </Alert>
      )}

      <div className="text-center space-y-4">
        <h3 className="text-lg font-semibold">Connect with Plaid</h3>
        <p className="text-sm text-muted-foreground">
          Securely connect your bank account through Plaid
        </p>

        {linkToken && ready ? (
          <Button
            onClick={handleConnectClick}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Connecting..." : "Connect Account"}
          </Button>
        ) : (
          <Button variant="outline" disabled className="w-full">
            {loading ? "Loading..." : "Preparing connection..."}
          </Button>
        )}
      </div>
    </div>
  );

  const renderManualView = () => (
    <div className="space-y-4">
      <Button
        variant="ghost"
        onClick={() => setView("main")}
        className="p-0 h-auto text-sm text-muted-foreground"
      >
        ← Back to options
      </Button>

      <form onSubmit={handleManualSubmit} className="space-y-4">
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
            onClick={() => setView("main")}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? "Adding..." : "Add Account"}
          </Button>
        </div>
      </form>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Add Account</span>
          </DialogTitle>
          <DialogDescription>
            Connect your bank accounts to track your finances
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {view === "main" && renderMainView()}
          {view === "plaid" && renderPlaidView()}
          {view === "manual" && renderManualView()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
