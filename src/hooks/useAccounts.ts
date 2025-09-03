"use client";

import { useState, useEffect, useCallback } from "react";

// The Account interface for the new API structure
export interface Account {
  id: string;
  name: string;
  mask?: string;
  balance_amount: number;
  available?: number;
  type: string;
  currency?: string;
  institution_name?: string;
  institution_logo_url?: string;
  last_synced_at?: string;
  provider?: string;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/accounts');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error("Error fetching accounts:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch accounts";
      setError(errorMessage);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return {
    accounts,
    loading,
    error,
    refetch: fetchAccounts,
  };
}

// --- HOW TO USE THIS NEW HOOK IN A COMPONENT ---
/*
import { useAccounts } from '@/hooks/useAccounts';

function MyAccountsComponent() {
  // It's this simple now! No need to find and pass the userId.
  const { accounts, loading, error, refetch } = useAccounts();

  if (loading) {
    return <div>Loading your accounts...</div>;
  }

  if (error) {
    return <div className="text-destructive">{error}</div>;
  }

  return (
    <div>
      <button onClick={refetch}>Refresh Accounts</button>
      <ul>
        {accounts.map(account => (
          <li key={account.id}>{account.name}: ${account.balance}</li>
        ))}
      </ul>
    </div>
  );
}
*/
