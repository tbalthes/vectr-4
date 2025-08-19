import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Account {
  id: string;
  created_at: string;
  user_id: string;
  name: string;
  type: string;
  balance: string;
  plaid_access_token?: string;
}

export function useAccounts(userId: string) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setAccounts([]);
      return;
    }

    async function fetchAccounts() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: supabaseError } = await supabase
          .from("accounts")
          .select("*")
          .eq("user_id", userId)
          .order("name");

        if (supabaseError) {
          throw supabaseError;
        }

        setAccounts(data || []);
      } catch (err) {
        console.error("Error fetching accounts:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch accounts"
        );
        // Set empty accounts on error to prevent UI issues
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAccounts();
  }, [userId]);

  const refetch = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: supabaseError } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", userId)
        .order("name");

      if (supabaseError) {
        throw supabaseError;
      }

      setAccounts(data || []);
    } catch (err) {
      console.error("Error refetching accounts:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch accounts");
    } finally {
      setLoading(false);
    }
  };

  return {
    accounts,
    loading,
    error,
    refetch,
  };
}
