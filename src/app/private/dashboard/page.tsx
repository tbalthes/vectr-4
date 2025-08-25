"use client";
import React from "react";
import { StatCards } from "@/components/private/dashboard/StatCards";
import { SpendingByCategory } from "@/components/private/dashboard/SpendingByCategory";
import { dashboardData } from "@/data/dashboard-data";
import { RecentTransactions } from "@/components/private/dashboard/RecentTransactions";
import { IncomeVsSpending } from "@/components/private/dashboard/IncomeVsSpending";
import PageHeader from "@/components/private/PageHeader";
import { Plus, Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import IncomeSpendingOverTimeChart from "@/components/private/dashboard/IncomeSpendingOverTime";
import { transactionData } from "@/data/dashboard-data";
import { BudgetCompositionChart } from "@/components/private/dashboard/BudgetCompositionChart";
import { Spending90v90 } from "@/components/private/dashboard/Spending90v90";
import { NetWorthOverTime } from "@/components/private/dashboard/NetWorthOverTime";
import { CategorySpending } from "@/components/private/dashboard/CategorySpendingChart";

export default function Dashboard() {
  const router = useRouter();

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back, John. Here's what's happening with your money."
        actions={
          <div className="flex items-center space-x-3 ">
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Last 30 days
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button size="sm" className="text-white" onClick={() => router.push("/private/upload")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Transactions
            </Button>
          </div>
        }
      />
      <div className="flex-1 space-y-6 p-6 animate-fade-in">
        {/* Stats Cards */}
        <StatCards />

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IncomeSpendingOverTimeChart />
          <Spending90v90 />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
