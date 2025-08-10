export const dashboardData = {
  totalBalance: "$12,450.32",
  totalBalanceChange: "+8.2%",
  monthlySpending: "$2,890.45",
  monthlySpendingChange: "-2.1%",
  monthlyIncome: "$4,600.00",
  monthlyIncomeChange: "+5.4%",
  savingsGoalPercent: "68%",
  savingsGoalValue: 68,
  savingsGoalLabel: "$6,800 of $10,000",
  spendingData: [
    { month: "Jan", spending: 2400, income: 4000 },
    { month: "Feb", spending: 2600, income: 4200 },
    { month: "Mar", spending: 2200, income: 3800 },
    { month: "Apr", spending: 2800, income: 4400 },
    { month: "May", spending: 3200, income: 4800 },
    { month: "Jun", spending: 2900, income: 4600 },
  ],

  categoryData: [
    { name: "Food & Dining", value: 850, color: "#3b82f6" },
    { name: "Transportation", value: 450, color: "#059669" },
    { name: "Entertainment", value: 320, color: "#d97706" },
    { name: "Utilities", value: 280, color: "#dc2626" },
    { name: "Shopping", value: 180, color: "#7c3aed" },
    { name: "Others", value: 320, color: "#6b7280" },
  ],

  recentTransactions: [
    {
      id: 1,
      description: "Whole Foods Market",
      amount: -85.42,
      category: "Food & Dining",
      date: "2 hours ago",
      type: "expense",
    },
    {
      id: 2,
      description: "Salary Deposit",
      amount: 3500.0,
      category: "Income",
      date: "Today",
      type: "income",
    },
    {
      id: 3,
      description: "Uber Ride",
      amount: -18.5,
      category: "Transportation",
      date: "Yesterday",
      type: "expense",
    },
    {
      id: 4,
      description: "Netflix Subscription",
      amount: -15.99,
      category: "Entertainment",
      date: "2 days ago",
      type: "expense",
    },
    {
      id: 5,
      description: "Freelance Project",
      amount: 750.0,
      category: "Income",
      date: "3 days ago",
      type: "income",
    },
  ],

  // ...any other fields
};
