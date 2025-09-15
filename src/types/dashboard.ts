// Shared dashboard types for all dashboard-related components

export interface SpendingData {
  month: string;
  income: number;
  spending: number;
}

export interface CategoryData {
  name: string;
  value: number;
  color: string;
}

export interface RecentTransaction {
  id: string | number;
  type: "income" | "spending";
  description: string;
  category: string;
  date: string;
  amount: number;
}

export interface DashboardData {
  spendingData: SpendingData[];
  categoryData: CategoryData[];
  recentTransactions: RecentTransaction[];
}
