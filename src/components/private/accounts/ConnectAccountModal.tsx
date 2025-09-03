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
import { Loader2, AlertCircle, CheckCircle, Building } from "lucide-react";

interface ConnectAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountConnected: () => void;
}

export function ConnectAccountModal({ open, onOpenChange, onAccountConnected }: ConnectAccountModalProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch link token when modal opens
  React.useEffect(() => {
    if (open && !linkToken) {
      fetchLinkToken();
    }
  }, [open, linkToken]);

  const fetchLinkToken = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/aggregator/plaid/create_link_token', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to create link token');
      }
      
      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create link token');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaidSuccess = async (public_token: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/aggregator/plaid/exchange_public_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ public_token }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to exchange token');
      }
      
      setSuccess(true);
      
      // Wait a moment to show success, then close and refresh
      setTimeout(() => {
        setSuccess(false);
        setLinkToken(null);
        onAccountConnected();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect account');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaidExit = () => {
    // User closed Plaid Link without completing
    setLoading(false);
  };

  const { open: openPlaidLink, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: handlePlaidExit,
  });

  const handleClose = () => {
    if (!loading) {
      setLinkToken(null);
      setError(null);
      setSuccess(false);
      onOpenChange(false);
    }
  };

  const handleConnectClick = () => {
    if (linkToken && ready) {
      openPlaidLink();
    } else {
      fetchLinkToken();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5" />
            <span>Connect Your Account</span>
          </DialogTitle>
          <DialogDescription>
            Securely connect your bank account using Plaid to automatically sync your transactions and balances.
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
                  <li>• You&apos;ll be redirected to your bank&apos;s secure login</li>
                  <li>• We&apos;ll fetch your accounts and recent transactions</li>
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
            <Button 
              onClick={handleConnectClick} 
              disabled={loading || (!linkToken && !error)}
              className="text-white"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Connecting...' : 'Connect Account'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
