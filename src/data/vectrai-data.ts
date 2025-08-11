// src/data/vectrai-data.ts
import type { AIInsight, ChatMessage, FinancialGoal } from "@/types/vectrai";

export const aiInsights: AIInsight[] = [
  {
    id: 1,
    type: "spending-optimization",
    title: "Optimize Food Spending",
    description:
      "You spent 23% more on dining out this month. Cooking at home 2 more times per week could save you $180/month.",
    impact: "high",
    savings: 180,
    confidence: 92,
    category: "Food & Dining",
  },
  {
    id: 2,
    type: "investment-opportunity",
    title: "Emergency Fund Complete",
    description:
      "Your emergency fund is fully funded! Consider investing the additional $500/month in a diversified portfolio.",
    impact: "medium",
    savings: 500,
    confidence: 88,
    category: "Investment",
  },
  {
    id: 3,
    type: "bill-optimization",
    title: "Subscription Analysis",
    description:
      "You have 3 streaming services costing $45/month. Consolidating to 2 services could save you $180/year.",
    impact: "low",
    savings: 15,
    confidence: 95,
    category: "Entertainment",
  },
];

export const chatHistory: ChatMessage[] = [
  {
    id: 1,
    type: "ai",
    message:
      "Hi! I'm Vectr AI. I can help you optimize your finances and answer questions about your spending patterns. What would you like to know?",
    timestamp: "10:00 AM",
  },
  {
    id: 2,
    type: "user",
    message: "Why did my food budget go over this month?",
    timestamp: "10:02 AM",
  },
  {
    id: 3,
    type: "ai",
    message:
      "I analyzed your transactions and found you spent $320 more on dining out compared to last month. The main contributors were:\n\n• 8 additional restaurant visits (+$240)\n• Higher average meal cost (+$80)\n\nWould you like me to suggest some budget-friendly alternatives?",
    timestamp: "10:02 AM",
  },
];

export const financialGoals: FinancialGoal[] = [
  {
    id: 1,
    title: "Emergency Fund",
    target: 10000,
    current: 10000,
    deadline: "2024-03-01",
    status: "completed",
  },
  {
    id: 2,
    title: "Vacation Fund",
    target: 3000,
    current: 1200,
    deadline: "2024-08-01",
    status: "on-track",
  },
  {
    id: 3,
    title: "New Car Down Payment",
    target: 8000,
    current: 2400,
    deadline: "2024-12-01",
    status: "behind",
  },
];
