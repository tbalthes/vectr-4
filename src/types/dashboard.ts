// Shared dashboard types for all dashboard-related components

export type SpendingData = {
  month: string;
  income: number;
  spending: number;
};

export type CategoryData = {
  name: string;
  value: number;
  color: string;
};

export type RecentTransaction = {
  id: string | number;
  type: "income" | "spending";
  description: string;
  category: string;
  date: string;
  amount: number;
};

export type DashboardData = {
  spendingData: SpendingData[];
  categoryData: CategoryData[];
  recentTransactions: RecentTransaction[];
};
