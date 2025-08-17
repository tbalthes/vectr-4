// src/types/transactions.ts

export interface Transaction {
  id: number;
  description: string;
  amount: number;
  category: string;
  date: string;
  account: string;
  type: "income" | "expense";
  status: "completed" | "pending";
}
