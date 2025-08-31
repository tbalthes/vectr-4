"use client";
import React from "react";
import { StatCards } from "@/components/private/dashboard/StatCards";
import { SpendingByCategory } from "@/components/private/dashboard/SpendingByCategory";
import { dashboardData } from "@/data/dashboard-data";
import { RecentTransactions } from "@/components/private/dashboard/RecentTransactions";
import PageHeader from "@/components/private/PageHeader";
import { Plus, Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import IncomeSpendingOverTimeChart from "@/components/private/dashboard/IncomeSpendingOverTime";
import { BudgetCompositionChart } from "@/components/private/dashboard/BudgetCompositionChart";
import { Spending90v90 } from "@/components/private/dashboard/Spending90v90";
import { NetWorthOverTime } from "@/components/private/dashboard/NetWorthOverTime";
import { CategorySpending } from "@/components/private/dashboard/CategorySpendingChart";
import SpendingHeatmap from "@/components/private/dashboard/SpendingHeatmap";

export default function Dashboard() {
  const router = useRouter();

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back, John. Here's what's happening with your money."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Last 30 days
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button
              size="sm"
              className="text-white"
              onClick={() => router.push("/private/upload")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Transactions
            </Button>
          </div>
        }
      />
      <div className="flex-1 space-y-6 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto animate-fade-in">
        {/* Stats Cards */}
        <StatCards />

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <IncomeSpendingOverTimeChart />
          <Spending90v90 />
        </div>
        <SpendingHeatmap range="1Y" mode="percentile" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          <BudgetCompositionChart />
          <NetWorthOverTime />
          <SpendingByCategory categories={dashboardData.categoryData} />
          <CategorySpending />
        </div>

        <RecentTransactions transactions={dashboardData.recentTransactions} />
      </div>
    </>
  );
}
