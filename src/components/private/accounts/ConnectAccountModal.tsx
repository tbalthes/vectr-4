"use client";
import React, { useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Building } from "lucide-react";
import { accountToasts } from "@/lib/notifications/account-notifications";
import { useAccountSync } from "@/contexts/AccountSyncContext";

interface ConnectAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountConnected: () => void;
}

export function ConnectAccountModal({
  open,
  onOpenChange,
  onAccountConnected,
}: ConnectAccountModalProps) {
  const { startAccountSync, updateAccountSync, completeAccountSync, errorAccountSync } = useAccountSync();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // --- Handlers must be defined before usePlaidLink ---
  const fetchLinkToken = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Fetching link token...");
      const response = await fetch("/api/aggregator/plaid/create_link_token", {
        method: "POST",
      });
      console.log("Link token response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Link token response error:", errorText);
        throw new Error(
          `Failed to create link token: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();
      console.log(
        "Link token received:",
        data.link_token?.substring(0, 20) + "..."
      );
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

  const handlePlaidSuccess = async (
    public_token: string,
    metadata: unknown
  ) => {
    console.log("=== PLAID SUCCESS HANDLER CALLED ===");
    console.log("Public token:", public_token.substring(0, 20) + "...");
    console.log("Metadata:", metadata);

    setLoading(true);
    setError(null);

  // Show connection progress using sync context (hook values are from component scope)
  startAccountSync({
      accountName: "New Account",
      step: 1,
      totalSteps: 3,
      currentOperation: "Exchanging secure token...",
      estimatedTime: "30 seconds",
    });

    try {
      console.log("Exchanging public token...");

      // Step 2: Exchange token
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

      console.log("Response status:", response.status);
      if (!response.ok) throw new Error("Failed to exchange token");

      const result = await response.json();
      console.log("Exchange successful:", result);

      // Step 3: Final setup
      updateAccountSync({
        accountName: "New Account",
        step: 3,
        totalSteps: 3,
        currentOperation: "Setting up account...",
        estimatedTime: "5 seconds",
      });

      // Simulate final setup time
      await new Promise((resolve) => setTimeout(resolve, 1000));

  // Show success via sync context
  completeAccountSync(result.accountName || "New Account", 0);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setLinkToken(null);
        onAccountConnected();
      }, 2000);
    } catch (err) {
      console.error("Error in handlePlaidSuccess:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to connect account";
      setError(errorMessage);
      errorAccountSync("New Account", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaidExit = (err: unknown, metadata: unknown) => {
    console.log("=== PLAID EXIT HANDLER CALLED ===");
    console.log("Error:", err);
    console.log("Metadata:", metadata);

    // Only treat as true cancellation - don't try to detect success here
    // Let onSuccess handle actual successful connections
    console.log("User cancelled or exited Plaid Link");
    setLoading(false);
  };

  // --- usePlaidLink hook must come after handlers ---
  const { open: openPlaidLink, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: handlePlaidExit,
  });

  // Fetch link token when modal opens
  React.useEffect(() => {
    if (open) {
      setLinkToken(null);
      setError(null);
      setSuccess(false);
      fetchLinkToken();
    }
  }, [open]);

  const handleClose = () => {
    if (!loading) {
      setLinkToken(null);
      setError(null);
      setSuccess(false);
      onOpenChange(false);
    }
  };

  // Manual test function
  const handleManualTest = () => {
    console.log("Manual test triggered");
    handlePlaidSuccess("public-sandbox-test-token-12345", { test: true });
  };

  const handleConnectClick = () => {
    console.log("Connect button clicked, opening Plaid Link...");
    if (linkToken && ready) {
      // Show pre-connection notification
      accountToasts.connectionWarning(1, "1-2 minutes");

      // Small delay to let user see the warning, then open Plaid
      setTimeout(() => {
        openPlaidLink();
      }, 1000);
    } else {
      console.log("Link token or ready state not available:", {
        linkToken: !!linkToken,
        ready,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} modal={false}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5" />
            <span>Connect Your Account</span>
          </DialogTitle>
          <DialogDescription>
            Securely connect your bank account using Plaid to automatically sync
            your transactions and balances.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Account connected successfully! Your data will sync shortly.
              </AlertDescription>
            </Alert>
          )}

          {!success && (
            <div className="text-center space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">What happens next?</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>
                    • You&apos;ll be redirected to your bank&apos;s secure login
                  </li>
                  <li>
                    • We&apos;ll fetch your accounts and recent transactions
                  </li>
                  <li>• Your data stays encrypted and secure</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex space-x-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          {!success && (
            <div className="flex space-x-2">
              {linkToken && ready ? (
                <Button onClick={handleConnectClick} disabled={loading}>
                  {loading ? "Connecting..." : "Connect Account"}
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  {loading
                    ? "Loading..."
                    : `Waiting for Link (Token: ${!!linkToken}, Ready: ${ready})`}
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={handleManualTest}
                disabled={loading}
              >
                Test Mock
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
