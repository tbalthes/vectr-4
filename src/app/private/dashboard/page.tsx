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

export default function Dashboard() {
  const router = useRouter();

  return (
    <div className="flex-1 space-y-6 p-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back, John. Here's what's happening with your money."
        actions={
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Last 30 days
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button size="sm" onClick={() => router.push("/private/upload")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Transactions
            </Button>
          </div>
        }
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
