"use client";

import { useState, useEffect, useCallback } from "react";
// Step 1: Import the correct client hook from the auth helpers library
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// The Account interface remains the same
export interface Account {
  id: string;
  created_at: string;
  user_id: string;
  name: string;
  type: string;
  balance: string; // Note: You might want to consider 'number' here in the future
  plaid_access_token?: string;
}

// Step 2: Remove the userId parameter from the hook's signature
export function useAccounts() {
  // Step 3: Create the cookie-aware Supabase client inside the hook
  const supabase = createClientComponentClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Step 4: Get the current user's session from the client
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // If there's no user, we can't fetch accounts.
      if (!user) {
        setAccounts([]);
        // We are not throwing an error, just returning an empty state.
        return;
      }

      // Step 5: Use the authenticated user's ID in the query
      const { data, error: supabaseError } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id) // Query for the logged-in user
        .order("name");

      if (supabaseError) {
        throw supabaseError;
      }

      setAccounts(data || []);
    } catch (err) {
      console.error("Error fetching accounts:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch accounts";
      setError(errorMessage);
      setAccounts([]); // Ensure accounts are cleared on error
    } finally {
      setLoading(false);
    }
  }, [supabase]); // Dependency: refetch only if the supabase client instance changes

  // Use useEffect to fetch data on initial component mount
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return {
    accounts,
    loading,
    error,
    // The refetch function is now just our stable fetchAccounts function
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
