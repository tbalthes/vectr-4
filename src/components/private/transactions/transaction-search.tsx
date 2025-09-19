'use client';

import React, { useState, useMemo } from 'react';

import { SearchInput } from '@/components/ui/search-input';
import type { FormattedTransaction } from '@/types/transactions';

interface TransactionSearchProps {
  transactions: FormattedTransaction[];
  onFilteredChange: (filtered: FormattedTransaction[]) => void;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function TransactionSearch({
  transactions,
  onFilteredChange,
  placeholder = 'Search transactions...',
  size = 'sm',
}: TransactionSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // EXACT same filtering logic from SearchFilterControls
  const filteredTransactions = useMemo(() => {
    console.log(
      'TransactionSearch filtering - received transactions:',
      transactions.length,
      'searchTerm:',
      searchTerm,
    );

    const s = searchTerm.trim().toLowerCase();

    if (s === '') {
      console.log('No search term, returning all', transactions.length, 'transactions');
      return transactions;
    }

    const filtered = transactions.filter((transaction) => {
      const searchMatch =
        (transaction.description || '').toLowerCase().includes(s) ||
        (transaction.originalDescription || '').toLowerCase().includes(s) ||
        (transaction.merchantName || '').toLowerCase().includes(s) ||
        (transaction.transaction_number || '').toLowerCase().includes(s);

      return searchMatch;
    });

    console.log('Search filtering complete - returning', filtered.length, 'transactions');
    return filtered;
  }, [transactions, searchTerm]);

  // Emit filtered results whenever they change
  React.useEffect(() => {
    console.log(
      'TransactionSearch useEffect - emitting',
      filteredTransactions.length,
      'filtered transactions',
    );
    onFilteredChange(filteredTransactions);
  }, [filteredTransactions, onFilteredChange]);

  // Debug when transactions prop changes
  React.useEffect(() => {
    console.log('TransactionSearch received new transactions prop:', transactions.length);
  }, [transactions]);

  // EXACT same handler logic from SearchFilterControls
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  return (
    <SearchInput
      placeholder={placeholder}
      value={searchTerm}
      onChange={handleSearchChange}
      size={size}
    />
  );
}
