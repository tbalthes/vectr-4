"use client";
import React from "react";
import { Wallet, TrendingUp, TrendingDown, CreditCard } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Account {
  id: string;
  name: string;
  balance_amount: number;
  available?: number;
  type: string;
  currency?: string;
}

interface AccountsStatsCardsProps {
  accounts: Account[];
  loading: boolean;
}

export function AccountsStatsCards({
  accounts,
  loading,
}: AccountsStatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-6 sm:h-7 lg:h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const totalBalance = accounts.reduce(
    (sum, account) => sum + (account.balance_amount || 0),
    0
  );
  const totalAssets = accounts
    .filter((account) => (account.balance_amount || 0) > 0)
    .reduce((sum, account) => sum + (account.balance_amount || 0), 0);
  const totalDebt = accounts.reduce((sum, account) => {
    const bal = account.balance_amount || 0;
    const type = (account.type || "").toLowerCase();
    // Count all loan and credit balances as debt (absolute value)
    if (type === "loan" || type === "credit") {
      return sum + Math.abs(bal);
    }
    return sum;
  }, 0);
  const accountCount = accounts.length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatCompactCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold truncate">
            <span className="hidden sm:inline">
              {formatCurrency(totalBalance)}
            </span>
            <span className="sm:hidden">
              {formatCompactCurrency(totalBalance)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Assets minus debts</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600 truncate">
            <span className="hidden sm:inline">
              {formatCurrency(totalAssets)}
            </span>
            <span className="sm:hidden">
              {formatCompactCurrency(totalAssets)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">All positive balances</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Debt</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600 truncate">
            <span className="hidden sm:inline">
              {formatCurrency(totalDebt)}
            </span>
            <span className="sm:hidden">
              {formatCompactCurrency(totalDebt)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            All loan and credit balances
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Linked Accounts</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold">
            {accountCount}
          </div>
          <p className="text-xs text-muted-foreground">
            Connected institutions
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
