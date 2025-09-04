"use client";
import React from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, AlertCircle, CreditCard, Building } from "lucide-react";

interface Account {
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

interface AccountsGridProps {
  accounts: Account[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function AccountCard({ account }: { account: Account }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: account.currency || "USD",
    }).format(amount);
  };

  const getAccountTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "checking":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "savings":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "credit":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "investment":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const isNegative = (account.balance_amount || 0) < 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {account.institution_logo_url ? (
              <Image
                src={account.institution_logo_url}
                alt={account.institution_name || "Institution"}
                width={32}
                height={32}
                className="rounded"
              />
            ) : (
              <Building className="w-8 h-8 text-muted-foreground" />
            )}
            <div>
              <CardTitle className="text-lg">{account.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {account.institution_name}
                {account.mask && ` •••• ${account.mask}`}
              </p>
            </div>
          </div>
          <Badge className={getAccountTypeColor(account.type)}>
            {account.type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p
              className={`text-2xl font-bold ${
                isNegative ? "text-red-600" : "text-green-600"
              }`}
            >
              {formatCurrency(account.balance_amount || 0)}
            </p>
          </div>

          {account.available !== undefined &&
            account.available !== account.balance_amount && (
              <div>
                <p className="text-sm text-muted-foreground">Available</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(account.available)}
                </p>
              </div>
            )}

          <div className="flex items-center justify-between pt-2">
            {account.provider && (
              <Badge
                variant="outline"
                className="text-xs"
                key={account.provider}
              >
                {account.provider}
              </Badge>
            )}
            {account.last_synced_at && (
              <p className="text-xs text-muted-foreground">
                Last sync:{" "}
                {new Date(account.last_synced_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Skeleton className="w-8 h-8 rounded" />
            <div>
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div>
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountsGrid({
  accounts,
  loading,
  error,
  onRefresh,
}: AccountsGridProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Accounts</h2>
          <Button variant="outline" size="sm" disabled>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <AccountCardSkeleton key={`skeleton-${i}`} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Accounts</h2>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
        <Card className="p-6">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>Error loading accounts: {error}</p>
          </div>
        </Card>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Accounts</h2>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        <Card className="p-12">
          <div className="text-center space-y-4">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">No accounts connected</h3>
              <p className="text-muted-foreground">
                Connect your first account to get started with Vectr.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your Accounts</h2>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account) => (
          <AccountCard key={account.id} account={account} />
        ))}
      </div>
    </div>
  );
}
