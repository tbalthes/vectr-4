"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CreditCard, AlertCircle } from "lucide-react";
import { accountToasts } from "@/lib/notifications/account-notifications";

interface PlaidLinkButtonProps {
  onAccountConnected?: () => void;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function PlaidLinkButton({
  onAccountConnected,
  variant = "default",
  size = "default",
  className,
}: PlaidLinkButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlaidLink = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Create link token
      const tokenResponse = await fetch("/api/aggregator/plaid/create_link_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error || "Failed to create link token");
      }

      const { link_token } = await tokenResponse.json();

      // Store the link token and callback info in sessionStorage for the redirect
      sessionStorage.setItem("plaid_link_token", link_token);
      sessionStorage.setItem("plaid_link_redirect", window.location.href);
      
      if (onAccountConnected) {
        sessionStorage.setItem("plaid_link_callback", "true");
      }

      // Redirect to Plaid Link page
      window.location.href = `/link-account?token=${encodeURIComponent(link_token)}`;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start account linking";
      setError(errorMessage);
      accountToasts.syncError("Plaid Link", errorMessage, true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={handlePlaidLink}
        disabled={isLoading}
        variant={variant}
        size={size}
        className={className}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            Connect Bank Account
          </>
        )}
      </Button>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
