"use client";

import { useState, useEffect, useCallback } from "react";
import { accountToasts } from "@/lib/notifications/account-notifications";
import { useAccountSync } from "@/contexts/AccountSyncContext";

// The Account interface for the new API structure
export interface Account {
  id: string;
  name: string;
  mask?: string;
  balance_amount: number;
  available?: number;
  type: string;
  subtype?: string;
  currency?: string;
  provider?: string;
  aggregator_account_id?: string;
  institution_id?: string;
  institution_name?: string;
  institution_logo_url?: string;
  institution_url?: string;
  institution_primary_color?: string;
  account_logo?: string;
  last_synced_at?: string;
  as_of?: string;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async (showNotifications = false) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/accounts");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const previousCount = accounts.length;
      setAccounts(data.accounts || []);

      // Only show bulk success toast for explicit refresh actions 
      // (when showNotifications is true AND we're not adding new accounts)
      if (showNotifications && data.accounts?.length > 0 && data.accounts.length === previousCount) {
        // Small delay to avoid overlapping with other notifications
        setTimeout(() => {
          accountToasts.bulkSuccess(data.accounts.length, "refreshed");
        }, 500);
      }
    } catch (err) {
      console.error("Error fetching accounts:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch accounts";
      setError(errorMessage);
      setAccounts([]);

      if (showNotifications) {
        accountToasts.syncError("accounts", errorMessage, true);
      }
    } finally {
      setLoading(false);
    }
  }, [accounts.length]);

  // Enhanced sync function with notifications
  const { startAccountSync, updateAccountSync, completeAccountSync, errorAccountSync } =
    useAccountSync();

  const syncAccount = useCallback(
    async (accountId: string, accountName: string) => {
      try {
        // Start progress via sync context (shows toast once)
        startAccountSync({
          accountName,
          step: 1,
          totalSteps: 3,
          currentOperation: "Connecting to institution...",
          estimatedTime: "30 seconds",
        });

        // Simulate sync steps - in real implementation this would be API calls
        await new Promise((resolve) => setTimeout(resolve, 1000));

        updateAccountSync({
          accountName,
          step: 2,
          totalSteps: 3,
          currentOperation: "Fetching transactions...",
          estimatedTime: "15 seconds",
        });

        await new Promise((resolve) => setTimeout(resolve, 1500));

        updateAccountSync({
          accountName,
          step: 3,
          totalSteps: 3,
          currentOperation: "Processing data...",
          estimatedTime: "5 seconds",
        });

        await new Promise((resolve) => setTimeout(resolve, 500));

        // Simulate API call to sync specific account
        const response = await fetch(`/api/accounts/${accountId}/sync`, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error(`Failed to sync ${accountName}`);
        }

        const result = await response.json();

        // Complete the sync via context (shows completion toast once)
        completeAccountSync(accountName, result.newTransactions || 0);

        // Refresh accounts list
        await fetchAccounts(false);

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Sync failed";
        errorAccountSync(accountName, errorMessage);
        throw err;
      }
    },
    [fetchAccounts, startAccountSync, updateAccountSync, completeAccountSync, errorAccountSync]
  );

  // Enhanced bulk sync function
  const { startBulkSync, completeBulkSync } = useAccountSync();

  const syncAllAccounts = useCallback(async () => {
    if (accounts.length === 0) {
      accountToasts.syncError("bulk sync", "No accounts to sync", false);
      return;
    }

    try {
      // Show pre-warning
      accountToasts.connectionWarning(accounts.length, "2-3 minutes");

      // Wait a moment for user to see the warning
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Start bulk sync via sync context
      startBulkSync({
        totalAccounts: accounts.length,
        completedAccounts: 0,
        estimatedTime: "2-3 minutes",
      });

      // Use bulk sync API endpoint
      const result = await fetch("/api/accounts/sync-all", {
        method: "POST",
      });

      if (!result.ok) {
        throw new Error("Bulk sync failed");
      }

      const syncResults = await result.json();

      // Complete bulk sync via sync context
      completeBulkSync(
        accounts.length,
        syncResults.totalNewTransactions || 0,
        syncResults.failedAccounts.length > 0
          ? syncResults.failedAccounts
          : undefined
      );

      // Refresh accounts list
      await fetchAccounts(false);

      return syncResults;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Bulk sync failed";
      accountToasts.syncError("bulk sync", errorMessage, true);
      throw err;
    }
  }, [accounts, fetchAccounts, startBulkSync, completeBulkSync]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return {
    accounts,
    loading,
    error,
    refetch: fetchAccounts,
    syncAccount,
    syncAllAccounts,
  };
}

// --- HOW TO USE THIS ENHANCED HOOK IN A COMPONENT ---
/*
import { useAccounts } from '@/hooks/useAccounts';

function MyAccountsComponent() {
  const { accounts, loading, error, refetch, syncAccount, syncAllAccounts } = useAccounts();

  const handleSyncAccount = async (accountId: string, accountName: string) => {
    try {
      await syncAccount(accountId, accountName);
    } catch (err) {
      console.error('Sync failed:', err);
    }
  };

  const handleSyncAll = async () => {
    try {
      const result = await syncAllAccounts();
      console.log('Bulk sync completed:', result);
    } catch (err) {
      console.error('Bulk sync failed:', err);
    }
  };

  if (loading) {
    return <div>Loading your accounts...</div>;
  }

  if (error) {
    return <div className="text-destructive">{error}</div>;
  }

  return (
    <div>
      <button onClick={() => refetch(true)}>Refresh Accounts</button>
      <button onClick={handleSyncAll}>Sync All Accounts</button>
      <ul>
        {accounts.map(account => (
          <li key={account.id}>
            {account.name}: ${account.balance_amount}
            <button onClick={() => handleSyncAccount(account.id, account.name)}>
              Sync
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
*/
