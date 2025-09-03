"use client";
import React, { useState } from "react";
import { Plus, CreditCard, TrendingUp, TrendingDown, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/private/PageHeader";
import { AccountsGrid } from "@/components/private/accounts/AccountsGrid";
import { AccountsStatsCards } from "@/components/private/accounts/AccountsStatsCards";
import { ConnectAccountModal } from "@/components/private/accounts/ConnectAccountModal";
import { useAccounts } from "@/hooks/useAccounts";

/* Removed duplicate default export AccountsPage to resolve redeclaration error */

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PiggyBank,
  Wallet,
  Building,
  Eye,
  EyeOff,
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  Settings,
} from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
const accountsData = [
  {
    id: 1,
    name: "Primary Checking",
    type: "checking",
    bank: "Chase Bank",
    balance: 5420.32,
    lastTransaction: "2024-01-15",
    accountNumber: "****1234",
    trend: "up",
    trendPercent: 2.5,
    status: "active",
  },
  {
    id: 2,
    name: "High Yield Savings",
    type: "savings",
    bank: "Marcus by Goldman Sachs",
    balance: 15750.0,
    lastTransaction: "2024-01-10",
    accountNumber: "****5678",
    trend: "up",
    trendPercent: 4.2,
    status: "active",
  },
  {
    id: 3,
    name: "Freedom Unlimited",
    type: "credit",
    bank: "Chase Bank",
    balance: -1240.55,
    creditLimit: 5000,
    lastTransaction: "2024-01-14",
    accountNumber: "****9012",
    trend: "down",
    trendPercent: 1.8,
    status: "active",
  },
  {
    id: 4,
    name: "Investment Portfolio",
    type: "investment",
    bank: "Fidelity",
    balance: 28450.75,
    lastTransaction: "2024-01-12",
    accountNumber: "****3456",
    trend: "up",
    trendPercent: 8.3,
    status: "active",
  },
  {
    id: 5,
    name: "Emergency Fund",
    type: "savings",
    bank: "Ally Bank",
    balance: 10000.0,
    lastTransaction: "2024-01-01",
    accountNumber: "****7890",
    trend: "up",
    trendPercent: 0.5,
    status: "active",
  },
];

const recentAccountActivity = [
  {
    id: 1,
    account: "Primary Checking",
    description: "Direct Deposit",
    amount: 3500.0,
    date: "2024-01-15",
  },
  {
    id: 2,
    account: "Freedom Unlimited",
    description: "Online Purchase",
    amount: -89.99,
    date: "2024-01-14",
  },
  {
    id: 3,
    account: "High Yield Savings",
    description: "Interest Payment",
    amount: 52.3,
    date: "2024-01-10",
  },
  {
    id: 4,
    account: "Investment Portfolio",
    description: "Dividend Payment",
    amount: 125.5,
    date: "2024-01-12",
  },
];

export default function Accounts() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [balancesVisible, setBalancesVisible] = useState(true);

  const totalAssets = accountsData
    .filter((acc) => acc.type !== "credit")
    .reduce((sum, acc) => sum + acc.balance, 0);

  const totalDebt = accountsData
    .filter((acc) => acc.type === "credit" && acc.balance < 0)
    .reduce((sum, acc) => sum + Math.abs(acc.balance), 0);

  const netWorth = totalAssets - totalDebt;

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "checking":
        return <Wallet className="h-5 w-5" />;
      case "savings":
        return <PiggyBank className="h-5 w-5" />;
      case "credit":
        return <CreditCard className="h-5 w-5" />;
      case "investment":
        return <TrendingUp className="h-5 w-5" />;
      default:
        return <Building className="h-5 w-5" />;
    }
  };

  const getAccountColor = (type: string) => {
    switch (type) {
      case "checking":
        return "bg-blue-100 text-blue-600";
      case "savings":
        return "bg-green-100 text-green-600";
      case "credit":
        return "bg-purple-100 text-purple-600";
      case "investment":
        return "bg-orange-100 text-orange-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Accounts</h1>
          <p className="text-gray-600 mt-1">
            Manage all your financial accounts in one place
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setBalancesVisible(!balancesVisible)}
          >
            {balancesVisible ? (
              <EyeOff className="mr-2 h-4 w-4" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {balancesVisible ? "Hide" : "Show"} Balances
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Connect Account
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Connect New Account</DialogTitle>
                <DialogDescription>
                  Connect a new bank account or credit card to Vectr.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="bank">Bank/Institution</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your bank" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chase">Chase Bank</SelectItem>
                      <SelectItem value="bofa">Bank of America</SelectItem>
                      <SelectItem value="wells">Wells Fargo</SelectItem>
                      <SelectItem value="citi">Citibank</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="accountType">Account Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="credit">Credit Card</SelectItem>
                      <SelectItem value="investment">Investment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="accountName">Account Nickname</Label>
                  <Input id="accountName" placeholder="e.g. Primary Checking" />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={() => setIsAddDialogOpen(false)}>
                  Connect Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Net Worth Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Net Worth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {balancesVisible ? `$${netWorth.toFixed(2)}` : "••••••"}
            </div>
            <p className="text-xs text-gray-500 flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" />
              +5.2% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {balancesVisible ? `$${totalAssets.toFixed(2)}` : "••••••"}
            </div>
            <p className="text-xs text-gray-500">
              Across{" "}
              {accountsData.filter((acc) => acc.type !== "credit").length}{" "}
              accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Debt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {balancesVisible ? `$${totalDebt.toFixed(2)}` : "••••••"}
            </div>
            <p className="text-xs text-gray-500">Credit cards</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accountsData.length}</div>
            <p className="text-xs text-gray-500">Connected institutions</p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accountsData.map((account) => (
          <Card key={account.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-2 rounded-lg ${getAccountColor(
                      account.type
                    )}`}
                  >
                    {getAccountIcon(account.type)}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{account.name}</CardTitle>
                    <CardDescription>
                      {account.bank} • {account.accountNumber}
                    </CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    {account.type === "credit"
                      ? "Current Balance"
                      : "Available Balance"}
                  </p>
                  <div className="text-2xl font-bold">
                    {balancesVisible ? (
                      <span
                        className={
                          account.balance < 0
                            ? "text-red-600"
                            : "text-green-600"
                        }
                      >
                        ${Math.abs(account.balance).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-400">••••••</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <div
                      className={`flex items-center text-xs ${
                        account.trend === "up"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {account.trend === "up" ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {account.trendPercent}%
                    </div>
                    <span className="text-xs text-gray-500">vs last month</span>
                  </div>
                </div>

                {account.type === "credit" && account.creditLimit && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Credit Utilization</span>
                      <span className="font-medium">
                        {(
                          (Math.abs(account.balance) / account.creditLimit) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                    <Progress
                      value={
                        (Math.abs(account.balance) / account.creditLimit) * 100
                      }
                      className="h-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      ${account.creditLimit - Math.abs(account.balance)}{" "}
                      available
                    </p>
                  </div>
                )}

                <div className="pt-3 border-t flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-500">Last Activity</p>
                    <p className="text-sm font-medium">
                      {account.lastTransaction}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {account.status}
                  </Badge>
                </div>

                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Settings className="mr-1 h-3 w-3" />
                    Manage
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Account Activity</CardTitle>
          <CardDescription>
            Latest transactions across all your accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentAccountActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between py-3 border-b last:border-b-0"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      activity.amount > 0
                        ? "bg-green-100 text-green-600"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {activity.amount > 0 ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {activity.account} • {activity.date}
                    </p>
                  </div>
                </div>
                <span
                  className={`font-semibold ${
                    activity.amount > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {activity.amount > 0 ? "+" : ""}$
                  {Math.abs(activity.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
