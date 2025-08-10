import React from "react";
import { StatCards } from "./dashboard/StatCards";
import { SpendingByCategory } from "./dashboard/SpendingByCategory";
import { dashboardData } from "../data/dashboard-data";
import { RecentTransactions } from "./dashboard/RecentTransactions";
import { IncomeVsSpending } from "./dashboard/IncomeVsSpending";
import { PageHeader } from "./dashboard/PageHeader";

// Define types for dashboardData if not already defined
type SpendingData = {
  month: string;
  income: number;
  spending: number;
};

type CategoryData = {
  name: string;
  value: number;
  color: string;
};

type RecentTransaction = {
  id: string | number;
  type: "income" | "spending";
  description: string;
  category: string;
  date: string;
  amount: number;
};

type DashboardData = {
  spendingData: SpendingData[];
  categoryData: CategoryData[];
  recentTransactions: RecentTransaction[];
};

export function Dashboard() {
  return (
    <div className="flex-1 space-y-6 p-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back, John. Here's what's happening with your money."
      />
      {/* Stats Cards */}
      <StatCards />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <IncomeVsSpending data={dashboardData.spendingData} />
        <SpendingByCategory categories={dashboardData.categoryData} />
      </div>

      <RecentTransactions transactions={dashboardData.recentTransactions} />
    </div>
  );
}
