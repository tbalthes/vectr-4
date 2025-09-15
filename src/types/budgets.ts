export interface Budget {
  id: number;
  category: string;
  budgetAmount: number;
  spentAmount: number;
  period: string;
  color: string;
  status: string;
  daysLeft: number;
}
