"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { TransactionTable } from "@/components/private/transactions/enhanced_table/TransactionTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search, Calendar, Filter, Plus } from "lucide-react";
import { TransactionFromApi, FormattedTransaction } from "@/types/transactions";
import { useAuth } from "@/contexts/AuthContext";
import { updateTransactionNote } from "@/lib/transactions";

// Helper function to format API data for UI
const formatApiDataForUI = (
  apiData: TransactionFromApi[]
): FormattedTransaction[] => {
  return apiData.map((tx) => {
    // Parse user_metadata if it's a string (JSONB from Supabase)
    let parsedUserMetadata = null;
    if (tx.user_metadata) {
      try {
        if (typeof tx.user_metadata === "string") {
          parsedUserMetadata = JSON.parse(tx.user_metadata);
        } else {
          parsedUserMetadata = tx.user_metadata;
        }

        // Debug log to see what we're getting
        console.log(
          "Parsed user_metadata for transaction:",
          tx.id,
          parsedUserMetadata
        );

        // Filter out unwanted fields and keep only user-mapped custom fields
        if (parsedUserMetadata && typeof parsedUserMetadata === "object") {
          const filteredMetadata: Record<string, string | number | boolean> =
            {};
          Object.entries(parsedUserMetadata).forEach(([key, value]) => {
            // Skip internal fields like _rowIndex, formattedAmount, and other system fields
            const isSystemField =
              key.startsWith("_") ||
              key.toLowerCase().includes("rowindex") ||
              key.toLowerCase().includes("formattedamount") ||
              key.toLowerCase().includes("index");

            if (
              !isSystemField &&
              value !== null &&
              value !== undefined &&
              value !== "" &&
              typeof value !== "object"
            ) {
              filteredMetadata[key] = value as string | number | boolean;
            }
          });
          parsedUserMetadata =
            Object.keys(filteredMetadata).length > 0 ? filteredMetadata : null;
        }
      } catch (error) {
        console.warn("Failed to parse user_metadata:", error);
        parsedUserMetadata = tx.user_metadata;
      }
    }

    // Format transaction number to remove decimals and ensure alphanumeric
    const formattedTransactionNumber = tx.transaction_number
      ? String(tx.transaction_number).replace(/\.\d+$/, "")
      : "";

    // Debug log to see what category data we're getting
    console.log("Transaction category data:", {
      transactionId: tx.id,
      merchantName: tx.merchants?.name,
      categoryName: tx.merchants?.categories?.name,
      categoryIcon: tx.merchants?.categories?.icon,
      fullMerchantData: tx.merchants,
    });

    return {
      id: tx.id,
      transaction_number: formattedTransactionNumber,
      date: tx.date,
      amount: tx.amount, // Keep original amount (negative for debits, positive for credits)
      originalDescription: tx.original_description,
      balance: tx.balance,
      userMetadata: parsedUserMetadata,
      needsReview: tx.needs_review || false,
      description: tx.merchants?.name || tx.clean_description,
      merchantName: tx.merchants?.name || "Unknown Merchant",
      merchantLogoUrl: tx.merchants?.logo_url || null,
      categoryName: tx.merchants?.categories?.name || "Uncategorized",
      categoryIcon: tx.merchants?.categories?.icon || "Package",
      note: tx.transaction_note || undefined,
    };
  });
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<FormattedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchData = async () => {
      // Check if user is authenticated
      if (!user) {
        console.error("No authenticated user found. Please log in.");
        setError("You must be logged in to view this page.");
        setLoading(false);
        return;
      }

      console.log("Authenticated user found:", user.id);

      try {
        // Use the API endpoint that bypasses RLS
        const response = await fetch("/api/transactions");

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const rawTransactions: TransactionFromApi[] = await response.json();
        const formattedTransactions = formatApiDataForUI(rawTransactions);
        setTransactions(formattedTransactions);
      } catch (err) {
        setError("Failed to fetch transactions.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleEditTransaction = (transaction: FormattedTransaction) => {
    /* ... */
  };
  const handleDeleteTransaction = async (transaction: FormattedTransaction) => {
    /* ... */
  };

  const handleUpdateNote = async (transactionId: string, note: string) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Optimistic update: update UI first, persist to Supabase, revert on failure
    const previousTransactions = transactions;

    // Apply optimistic change
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === transactionId ? { ...tx, note: note || undefined } : tx
      )
    );

    try {
      await updateTransactionNote(supabase, transactionId, note);
    } catch (error) {
      console.error("Failed to update transaction note:", error);
      // Revert local state to previous value
      setTransactions(previousTransactions);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[700px] w-full" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-destructive font-semibold">{error}</div>;
  }

  // Also good practice to handle the case where a user has no transactions
  if (transactions.length === 0) {
    return <div className="p-6">No transactions found.</div>;
  }

  return (
    <>
      {/* Custom header similar to dashboard but not the same component */}
      <div className="h-16 sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm shadow-black/10 dark:shadow-white/10 flex items-center justify-between px-6 py-4 w-full">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">View and manage your transactions</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm">
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
          <Button variant="outline" size="sm">
            <Calendar className="mr-2 h-4 w-4" />
            Date
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <Button variant="outline" size="sm">
            Edit rules
          </Button>
          <Button size="sm" onClick={() => router.push("/private/upload")}>
            <Plus className="mr-2 h-4 w-4" />
            Add transaction
          </Button>
        </div>
      </div>
      
      <div className="p-3 space-y-6">
        <TransactionTable
          transactions={transactions}
          onEdit={handleEditTransaction}
          onDelete={handleDeleteTransaction}
          onUpdateNote={handleUpdateNote}
          className=""
        />
      </div>
    </>
  );
}
