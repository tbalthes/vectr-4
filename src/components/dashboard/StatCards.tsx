import React from "react";
import { Card, CardContent } from "../ui/card";
import { Progress } from "../ui/progress";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  PiggyBank,
  ArrowUpRight,
} from "lucide-react";
import { dashboardData } from "@/data/dashboard-data";

export function StatCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Balance */}
      <Card className="card-clean card-hover">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Total Balance</p>
              <p className="text-2xl font-bold text-foreground">
                {dashboardData.totalBalance}
              </p>
            </div>
            <div className="h-8 w-8 bg-success/10 rounded-lg flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            <TrendingUp className="h-3 w-3 text-success mr-1" />
            <span className="text-xs font-medium text-success">
              {dashboardData.totalBalanceChange}
            </span>
            <span className="text-xs text-muted ml-2">from last month</span>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Spending */}
      <Card className="card-clean card-hover">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Monthly Spending</p>
              <p className="text-2xl font-bold text-foreground">
                {dashboardData.monthlySpending}
              </p>
            </div>
            <div className="h-8 w-8 bg-destructive/10 rounded-lg flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-destructive" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            <TrendingDown className="h-3 w-3 text-success mr-1" />
            <span className="text-xs font-medium text-success">
              {dashboardData.monthlySpendingChange}
            </span>
            <span className="text-xs text-muted ml-2">from last month</span>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Income */}
      <Card className="card-clean card-hover">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Monthly Income</p>
              <p className="text-2xl font-bold text-foreground">
                {dashboardData.monthlyIncome}
              </p>
            </div>
            <div className="h-8 w-8 bg-info/10 rounded-lg flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4 text-info" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            <TrendingUp className="h-3 w-3 text-success mr-1" />
            <span className="text-xs font-medium text-success">
              {dashboardData.monthlyIncomeChange}
            </span>
            <span className="text-xs text-muted ml-2">from last month</span>
          </div>
        </CardContent>
      </Card>

      {/* Savings Goal */}
      <Card className="card-clean card-hover">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Savings Goal</p>
              <p className="text-2xl font-bold text-foreground">
                {dashboardData.savingsGoalPercent}
              </p>
            </div>
            <div className="h-8 w-8 bg-warning/10 rounded-lg flex items-center justify-center">
              <PiggyBank className="h-4 w-4 text-warning" />
            </div>
          </div>
          <div className="mt-4">
            <Progress value={dashboardData.savingsGoalValue} className="h-2" />
            <p className="text-xs text-muted mt-2">
              {dashboardData.savingsGoalLabel}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}