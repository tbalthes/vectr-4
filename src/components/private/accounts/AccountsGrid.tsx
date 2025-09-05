"use client";

import React, { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  MoreHorizontal,
  Building2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { arrayMove } from "@dnd-kit/sortable";
import LuxuryAccountCard from "./LuxuryAccountCard";
import { Account } from "@/hooks/useAccounts";
import { accountToasts } from "@/lib/notifications/account-notifications";
import { toast } from "sonner";
import { useAccountSync } from "@/contexts/AccountSyncContext";

interface AccountsGridProps {
  accounts: Account[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSyncAccount?: (accountId: string, accountName: string) => Promise<void>;
  onSyncAll?: () => Promise<
    | {
        successful: number;
        failed: number;
        failedAccounts: string[];
        totalNewTransactions: number;
      }
    | undefined
  >;
}

function AccountCard({
  account,
  onSync,
  isBeingSynced,
  onDisconnect,
}: {
  account: Account;
  onSync?: (accountId: string, accountName: string) => Promise<void>;
  isBeingSynced: boolean;
  onDisconnect?: (accountId: string) => void;
}) {
  const [balanceVisible, setBalanceVisible] = React.useState(true);
  const [isSyncing, setIsSyncing] = React.useState(false);

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

  const isNegative = account.balance_amount < 0;
  const displayBalance = balanceVisible
    ? formatCurrency(account.balance_amount || 0)
    : "••••••";

  const handleSync = async () => {
    if (!onSync || isSyncing || isBeingSynced) return;

    setIsSyncing(true);
    try {
      await onSync(account.id, account.name);
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRename = () => {
    // Simulate account rename
    const newName = prompt("Enter new account name:", account.name);
    if (newName && newName !== account.name) {
      accountToasts.renamed(account.name, newName);
    }
  };

  const handleDisconnect = async () => {
    if (!onDisconnect) return;
    if (confirm(`Are you sure you want to disconnect ${account.name}?`)) {
      try {
        const res = await fetch(`/api/accounts/${account.id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          accountToasts.disconnected(account.name);
          onDisconnect(account.id);
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(`Failed to disconnect: ${data.error || res.statusText}`);
        }
      } catch {
        toast.error("Network error disconnecting account");
      }
    }
  };

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-muted">
              {account.institution_logo_url ? (
                <Image
                  src={account.institution_logo_url}
                  alt={`${account.institution_name || "Bank"} logo`}
                  width={16}
                  height={16}
                  className="object-contain"
                  onError={() => {
                    // Show fallback icon if logo fails to load
                    console.log(
                      "Institution logo failed to load:",
                      account.institution_logo_url
                    );
                  }}
                />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg font-semibold truncate">
                {account.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {account.institution_name || account.provider || "Unknown Bank"}
                {account.mask && ` •••• ${account.mask}`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBalanceVisible(!balanceVisible)}
              className="h-8 w-8 p-0"
            >
              {balanceVisible ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleSync}
                  disabled={isSyncing || isBeingSynced}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${
                      isSyncing || isBeingSynced ? "animate-spin" : ""
                    }`}
                  />
                  {isSyncing || isBeingSynced ? "Syncing..." : "Sync Account"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRename}>
                  Rename Account
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDisconnect}
                  className="text-red-600"
                >
                  Disconnect Account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <Badge className={getAccountTypeColor(account.type)}>
          {account.type}
        </Badge>
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
              {displayBalance}
            </p>
          </div>

          {account.available !== undefined &&
            account.available !== account.balance_amount && (
              <div>
                <p className="text-sm text-muted-foreground">Available</p>
                <p className="text-lg font-semibold">
                  {balanceVisible
                    ? formatCurrency(account.available)
                    : "••••••"}
                </p>
              </div>
            )}

          <div className="flex items-center justify-between pt-2">
            {account.provider && (
              <Badge
                variant="outline"
                className="text-xs"
                key={`${account.id}-provider`}
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

          {isBeingSynced && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Syncing account...</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <Card key={`loading-skeleton-${i}`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-8 w-8 rounded" />
            </div>
            <Skeleton className="h-6 w-20" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-8 w-32" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AccountsGrid({
  accounts: initialAccounts,
  loading,
  error,
  onRefresh,
  onSyncAccount,
  onSyncAll,
}: AccountsGridProps) {
  const [accounts, setAccounts] = React.useState(initialAccounts);
  React.useEffect(() => {
    setAccounts(initialAccounts);
  }, [initialAccounts]);
  const handleDisconnectAccount = (accountId: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
  };
  const { isAccountSyncing, isBulkSyncing } = useAccountSync();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSyncAll = async () => {
    if (!onSyncAll || isBulkSyncing()) return;
    try {
      await onSyncAll();
    } catch (error) {
      console.error("Bulk sync failed:", error);
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Accounts</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
        <Card className="p-12">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-red-600">
                Error loading accounts
              </h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
            <Button onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Try Again
            </Button>
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
        <Card className="p-12">
          <div className="text-center space-y-4">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">No accounts connected</h3>
              <p className="text-muted-foreground">
                Connect your bank accounts to start tracking your finances
              </p>
            </div>
            <Button onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your Accounts</h2>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          {accounts.length > 1 && onSyncAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncAll}
              disabled={isBulkSyncing()}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  isBulkSyncing() ? "animate-spin" : ""
                }`}
              />
              Sync All
            </Button>
          )}
        </div>
      </div>

      {/* Accounts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onSync={onSyncAccount}
            isBeingSynced={isAccountSyncing(account.name)}
            onDisconnect={handleDisconnectAccount}
          />
        ))}
      </div>
    </div>
  );
}
