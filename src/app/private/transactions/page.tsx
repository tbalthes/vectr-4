"use client";

import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import AddTransactionModal from "@/components/private/transactions/AddTransactionModal";
import SearchBar from "@/components/private/transactions/SearchBar";
import PageHeader from "@/components/private/PageHeader";
import TransactionTable from "@/components/private/transactions/TransactionTable";

// Swap this import with a Supabase query for production
import { allTransactions as rawTransactions } from "@/data/transaction-data";
import type { Transaction } from "@/types/transactions";

export default function Transactions() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const allTransactions = rawTransactions as Transaction[];
  const filteredTransactions = allTransactions.filter((transaction) => {
    const matchesSearch = transaction.description
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || transaction.category === selectedCategory;
    const matchesAccount =
      selectedAccount === "all" || transaction.account === selectedAccount;
    return matchesSearch && matchesCategory && matchesAccount;
  });

  const categories = [...new Set(allTransactions.map((t) => t.category))];
  const accounts = [...new Set(allTransactions.map((t) => t.account))];

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
            <AddTransactionModal
              open={isAddDialogOpen}
              setOpen={setIsAddDialogOpen}
            />
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
      <TransactionTable
        transactions={filteredTransactions}
        allCount={allTransactions.length}
      />
    </div>
  );
}
