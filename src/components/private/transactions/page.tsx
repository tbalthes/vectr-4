'use client';

import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import AddTransactionModal from '@/components/private/transactions/AddTransactionModal';
import SearchBar from '@/components/private/transactions/SearchBar';
import PageHeader from '@/components/private/PageHeader';
import TransactionTable from '@/components/private/transactions/TransactionTable';
// Swap this import with a Supabase query for production
import { allTransactions as rawTransactions } from '@/data/transaction-data';
// Update the import to match the actual exported type from "@/types/transactions"
import type { FormattedTransaction } from '@/types/transactions';

// Hook to fetch all available categories
function useAllCategories() {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/analytics/categories?namesOnly=true', {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch categories: ${response.status}`);
        }
        const data = await response.json();
        setCategories(data.data || []);
      } catch (err) {
        console.error('Error fetching categories:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch categories');
        // Fallback to extracting from mock data
        const fallbackCategories = [...new Set(rawTransactions.map((t) => t.category))];
        setCategories(fallbackCategories);
      } finally {
        setLoading(false);
      }
    };

    void fetchCategories();
  }, []);

  return { categories, loading, error };
}

// Define the raw transaction type from mock data
interface RawTransaction {
  id: number;
  description: string;
  amount: number;
  category: string;
  date: string;
  account: string;
  type: string;
  status: string;
}

// Converter function from Transaction to FormattedTransaction for mock data
function convertToFormattedTransaction(transaction: RawTransaction): FormattedTransaction {
  return {
    // Core fields
    transactionId: transaction.id.toString(),
    originalDescription: transaction.description,
    accountId: '',
    date: transaction.date,
    description: transaction.description,
    amount: transaction.amount,
    currency: null,
    pending: false,

    // Enriched/UI fields
    merchantName: transaction.description,
    merchantLogoUrl: null,
    categoryName: transaction.category,
    categoryIcon: 'Utensils',

    // Account info
    accountName: transaction.account,
    accountMask: null,

    // UI state
    needsReview: false,
    isHidden: false,
    notes: null,

    // Compatibility
    type: (transaction.type as 'income' | 'expense') ?? 'expense',
    status: (transaction.status as 'completed' | 'pending') ?? 'completed',

    // Raw data placeholder
    originalData: {} as any,
  };
}

export default function Transactions() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Fetch all available categories from API
  const { categories: allCategories } = useAllCategories();

  const allTransactions = rawTransactions.map(convertToFormattedTransaction);
  const filteredTransactions = allTransactions.filter((transaction) => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || transaction.categoryName === selectedCategory;
    const matchesAccount = selectedAccount === 'all' || transaction.accountName === selectedAccount;
    return matchesSearch && matchesCategory && matchesAccount;
  });

  // Use fetched categories, fallback to mock data categories if API fails
  const rawCategories =
    allCategories.length > 0
      ? allCategories
      : [...new Set(allTransactions.map((t) => t.categoryName))];
  const categories: string[] = rawCategories.filter((c): c is string => !!c);
  const accounts = [...new Set(allTransactions.map((t) => t.accountName))].filter(
    (a): a is string => !!a,
  );

  return (
    <div className="flex-1 space-y-6 p-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Transactions"
        subtitle="Track and manage all your financial transactions"
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <AddTransactionModal open={isAddDialogOpen} setOpen={setIsAddDialogOpen} />
          </>
        }
      />

      {/* Filters/Search Bar */}
      <SearchBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        selectedAccount={selectedAccount}
        setSelectedAccount={setSelectedAccount}
        categories={categories}
        accounts={accounts}
      />

      {/* Transactions Table */}
      <TransactionTable transactions={filteredTransactions} allCount={allTransactions.length} />
    </div>
  );
}
