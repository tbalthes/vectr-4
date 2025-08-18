import React from "react";
import { Card, CardContent } from "../../ui/card";
import { Progress } from "../../ui/progress";
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
  // Determine color classes based on savings goal percentage
  const getSavingsGoalColorClasses = (value: number) => {
    if (value >= 80) {
      return {
        bg: "bg-success/10",
        text: "text-success",
        icon: "text-success"
      };
    } else if (value >= 50) {
      return {
        bg: "bg-warning/10",
        text: "text-warning",
        icon: "text-warning"
      };
    } else {
      return {
        bg: "bg-destructive/10",
        text: "text-destructive",
        icon: "text-destructive"
      };
    }
  };

  const savingsGoalColors = getSavingsGoalColorClasses(dashboardData.savingsGoalValue);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Balance */}
      <Card className="card-clean card-hover">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold  ">Total Balance</p>
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
            <span className="text-xs  font-semibold text-success">
              {dashboardData.totalBalanceChange}
            </span>
            <span className="text-xs ml-2">from last month</span>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Spending */}
      <Card className="card-clean card-hover">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm  font-semibold ">Monthly Spending</p>
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
            <span className="text-xs  font-semibold text-success">
              {dashboardData.monthlySpendingChange}
            </span>
            <span className="text-xs   ml-2">from last month</span>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Income */}
      <Card className="card-clean card-hover">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm  font-semibold  ">Monthly Income</p>
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
            <span className="text-xs  font-semibold text-success">
              {dashboardData.monthlyIncomeChange}
            </span>
            <span className="text-xs   ml-2">from last month</span>
          </div>
        </CardContent>
      </Card>

      {/* Savings Goal */}
      <Card className="card-clean card-hover">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm  font-semibold  ">Savings Goal</p>
              <p className="text-2xl font-bold text-foreground">
                {dashboardData.savingsGoalPercent}
              </p>
            </div>
            <div className={`h-8 w-8 ${savingsGoalColors.bg} rounded-lg flex items-center justify-center`}>
              <PiggyBank className={`h-4 w-4 ${savingsGoalColors.icon}`} />
            </div>
          </div>
          <div className="mt-4">
            <Progress value={dashboardData.savingsGoalValue} className="h-2" />
            <p className="text-xs   mt-2">
              {dashboardData.savingsGoalLabel}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
