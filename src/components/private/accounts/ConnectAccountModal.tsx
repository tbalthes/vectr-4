"use client";
import { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { accountToasts } from "@/lib/notifications/account-notifications";

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
  const [linkToken, setLinkToken] = useState<string | null>(null);

  // Fetch link token when modal opens
  const fetchLinkToken = useCallback(async () => {
    try {
      console.log("Fetching Plaid link token...");
      const response = await fetch("/api/aggregator/plaid/create_link_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create link token");
      }

      const { link_token } = await response.json();
      console.log("Link token received");
      setLinkToken(link_token);
    } catch (err) {
      console.error("Error fetching link token:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start account linking";
      accountToasts.syncError("Plaid Link", errorMessage, true);
      onOpenChange(false);
    }
  }, [onOpenChange]);

  useEffect(() => {
    if (open && !linkToken) {
      fetchLinkToken();
    }
  }, [open, linkToken, fetchLinkToken]);

  // Temporarily disable all Plaid CSS overrides to let modal_only work
  useEffect(() => {
    if (open) {
      const style = document.createElement("style");
      style.id = "plaid-modal-only-fix";
      style.textContent = `
        /* DISABLE ALL PLAID Z-INDEX OVERRIDES */
        iframe[src*="plaid"],
        [id*="plaid"],
        [class*="plaid"],
        [data-testid*="plaid"] {
          z-index: auto !important;
        }
        
        /* Let Plaid handle its own modal styling with modal_only */
        body > div[style*="position: fixed"] {
          background: unset !important;
          z-index: auto !important;
        }
      `;
      document.head.appendChild(style);

      return () => {
        const existingStyle = document.getElementById("plaid-modal-only-fix");
        if (existingStyle) {
          document.head.removeChild(existingStyle);
        }
      };
    }
  }, [open]);

  const { open: openPlaidLink, ready } = usePlaidLink({
    token: linkToken,
    env: process.env.NODE_ENV === "production" ? "production" : "sandbox",
    onLoad: () => {
      console.log("🎯 Plaid Link loaded - checking for modal_only behavior...");
    },
    onSuccess: async (public_token, metadata) => {
      console.log("Plaid Link success, exchanging token...");

      try {
        const response = await fetch(
          "/api/aggregator/plaid/exchange_public_token",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              public_token,
              metadata,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to link account");
        }

        const result = await response.json();
        console.log("Account linking successful:", result);

        // Show success notification
        accountToasts.connected(
          result.institution_name || "Bank Account",
          `${result.accounts_linked || 0} accounts linked successfully`
        );

        // Close modal and trigger callback
        onOpenChange(false);
        onAccountConnected();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to link account";
        console.error("Error exchanging token:", err);
        accountToasts.syncError("Account Linking", errorMessage, true);
        onOpenChange(false);
      }
    },
    onExit: (err, metadata) => {
      console.log("Plaid Link exited:", { err, metadata });

      if (err) {
        console.error("Plaid Link error:", err);
        accountToasts.syncError(
          "Account Linking",
          `Connection cancelled: ${
            err.error_message || err.error_code || "Unknown error"
          }`,
          false
        );
      }

      // Always close modal and reset
      setLinkToken(null);
      onOpenChange(false);
    },
  });

  // Automatically open Plaid Link when token is ready
  useEffect(() => {
    if (linkToken && ready && open) {
      console.log("Opening Plaid Link...");
      openPlaidLink();
    }
  }, [linkToken, ready, openPlaidLink, open]);

  // Reset token when modal closes
  useEffect(() => {
    if (!open) {
      setLinkToken(null);
    }
  }, [open]);

  // Don't render anything - Plaid Link will handle its own modal
  return null;
}
