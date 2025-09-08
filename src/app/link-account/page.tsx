"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, Shield, Lock, AlertCircle } from "lucide-react";
import { accountToasts } from "@/lib/notifications/account-notifications";

function PlaidLinkContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setLinkToken(token);
    } else {
      // Try to get token from sessionStorage
      const storedToken = sessionStorage.getItem("plaid_link_token");
      if (storedToken) {
        setLinkToken(storedToken);
      } else {
        setError("No link token provided");
      }
    }
  }, [searchParams]);

  const { open: openPlaidLink, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      setIsProcessing(true);
      
      try {
        console.log("Plaid Link success, exchanging token...");
        
        const response = await fetch("/api/aggregator/plaid/exchange_public_token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token,
            metadata,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to link account");
        }

        const result = await response.json();
        console.log("Account linking successful:", result);

        // Clear stored data
        sessionStorage.removeItem("plaid_link_token");
        const redirectUrl = sessionStorage.getItem("plaid_link_redirect");
        const hasCallback = sessionStorage.getItem("plaid_link_callback");
        sessionStorage.removeItem("plaid_link_redirect");
        sessionStorage.removeItem("plaid_link_callback");

        // Show success notification
        accountToasts.connected(
          result.institution_name || "Bank Account",
          `${result.accounts_linked || 0} accounts linked successfully`
        );

        // Redirect back to original page
        if (redirectUrl) {
          window.location.href = redirectUrl + (hasCallback ? "?connected=true" : "");
        } else {
          router.push("/private/accounts");
        }
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to link account";
        setError(errorMessage);
        accountToasts.syncError("Account Linking", errorMessage, true);
      } finally {
        setIsProcessing(false);
      }
    },
    onExit: (err, metadata) => {
      console.log("Plaid Link exited:", { err, metadata });
      
      // Clean up
      sessionStorage.removeItem("plaid_link_token");
      const redirectUrl = sessionStorage.getItem("plaid_link_redirect");
      sessionStorage.removeItem("plaid_link_redirect");
      sessionStorage.removeItem("plaid_link_callback");
      
      if (err) {
        setError(`Link process cancelled: ${err.error_message || err.error_code || "Unknown error"}`);
      }
      
      // Redirect back after a short delay
      setTimeout(() => {
        if (redirectUrl) {
          window.location.href = redirectUrl;
        } else {
          router.push("/private/accounts");
        }
      }, 2000);
    },
  });

  useEffect(() => {
    if (linkToken && ready && !isProcessing) {
      // Automatically open Plaid Link when ready
      openPlaidLink();
    }
  }, [linkToken, ready, openPlaidLink, isProcessing]);

  const handleGoBack = () => {
    const redirectUrl = sessionStorage.getItem("plaid_link_redirect");
    sessionStorage.removeItem("plaid_link_token");
    sessionStorage.removeItem("plaid_link_redirect");
    sessionStorage.removeItem("plaid_link_callback");
    
    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      router.push("/private/accounts");
    }
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Linking Your Account
            </h2>
            <p className="text-gray-600">
              Please wait while we securely connect your bank account...
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <Shield className="h-4 w-4" />
              <span>Bank-level security</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xl">P</span>
            </div>
          </div>
          
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Connect Your Bank Account
            </h1>
            <p className="text-gray-600">
              Securely link your bank account using Plaid&apos;s encrypted connection
            </p>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : !ready ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
              <p className="text-sm text-gray-500">
                Preparing secure connection...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 text-blue-800">
                  <Lock className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Your connection is secured by 256-bit encryption
                  </span>
                </div>
              </div>
              <Button 
                onClick={() => openPlaidLink()} 
                className="w-full"
                size="lg"
              >
                Open Plaid Link
              </Button>
            </div>
          )}

          <div className="pt-4 border-t">
            <Button 
              variant="ghost" 
              onClick={handleGoBack}
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlaidLinkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <PlaidLinkContent />
    </Suspense>
  );
}
