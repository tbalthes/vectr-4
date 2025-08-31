"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Zap, MessageSquare, Code, FileText } from "lucide-react";
import {
  Message,
  MessageContent,
  Response,
  Reasoning,
  Tool,
  Sources,
  Suggestion,
  Task,
  Action
} from "@/components/ai";

export default function ComponentLibraryDemo() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">Shadcn AI Components Library</h1>
        <p className="text-lg text-muted-foreground">
          Complete suite of AI-powered React components for conversational interfaces
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">12+</div>
            <div className="text-sm text-muted-foreground">Components</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">100%</div>
            <div className="text-sm text-muted-foreground">TypeScript</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">AI+</div>
            <div className="text-sm text-muted-foreground">Gemini Ready</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">📱</div>
            <div className="text-sm text-muted-foreground">Responsive</div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: "overview", label: "Overview", icon: Shield },
          { id: "messages", label: "Messages", icon: MessageSquare },
          { id: "ai-features", label: "AI Features", icon: Zap },
          { id: "code", label: "Code", icon: Code },
          { id: "actions", label: "Actions", icon: FileText }
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "outline"}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2"
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Content Sections */}
      {activeTab === "overview" && (
        <Card>
          <CardHeader>
            <CardTitle>Complete AI Components Library</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Your complete Shadcn AI components library includes everything needed for modern
              conversational AI interfaces, built on shadcn/ui principles.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { name: "Message", desc: "Chat message containers with role-based styling" },
                { name: "Response", desc: "Streaming markdown renderer with syntax highlighting" },
                { name: "Conversation", desc: "Auto-scrolling chat container with controls" },
                { name: "PromptInput", desc: "Rich textarea with toolbar and auto-resize" },
                { name: "Tool", desc: "Collapsible tool execution displays" },
                { name: "Reasoning", desc: "AI thought process visualization" },
                { name: "Sources", desc: "Source citations and references" },
                { name: "Suggestion", desc: "Quick prompt suggestions" },
                { name: "Task", desc: "Task management with progress tracking" },
                { name: "Actions", desc: "Interactive action buttons" },
                { name: "Loader", desc: "Multiple loading animation types" },
              ].map((component) => (
                <div key={component.name} className="flex items-start gap-3 p-3 border rounded">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-medium">{component.name}</span>
                    <p className="text-sm text-muted-foreground">{component.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "messages" && (
        <Card>
          <CardHeader>
            <CardTitle>Message Components</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border rounded-lg p-4 bg-muted/10">
              <h4 className="font-medium mb-3">User Message</h4>
              <Message from="user" timestamp="Now">
                <MessageContent>
                  <Response>Hello! Can you help me analyze my spending patterns?</Response>
                </MessageContent>
              </Message>
            </div>

            <div className="border rounded-lg p-4 bg-muted/10">
              <h4 className="font-medium mb-3">AI Response with Formatting</h4>
              <Message from="assistant" timestamp="Now">
                <MessageContent>
                  <Response>Here's your spending analysis! I'll break it down for you:

## Key Insights
- **Groceries**: \$450/month (32% of spending)
- **Transportation**: \$180/month (15% of spending)

**Savings Opportunity**: You could save \$45/month on dining out.

Here's a quick code example of how you can track this:
```javascript
const spendingAnalysis = {
  total: 1400,
  breakdown: {
    groceries: { amount: 450, percentage: 32 },
    transportation: { amount: 180, percentage: 15 },
    dining: { amount: 280, percentage: 20 }
  },
  recommendations: [
    "Consider meal planning for groceries",
    "Look into transit passes for transportation"
  ]
};
```

What would you like me to focus on next? 💰</Response>
                </MessageContent>
              </Message>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "ai-features" && (
        <Card>
          <CardHeader>
            <CardTitle>AI-Specific Components</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Tool Execution */}
            <div>
              <h4 className="font-medium mb-3">Tool Execution</h4>
              <Tool
                name="spending_analyzer"
                status="complete"
                title="Spending Pattern Analyzer"
                description="Analyzing transaction data from the last 3 months"
                result="Found 45 transactions across 8 categories. Average daily spending: $47.32"
                duration="1.2s"
              />

              <Tool
                name="budget_optimizer"
                status="running"
                title="Budget Optimization Engine"
                description="Generating personalized budget recommendations"
                duration="Processing..."
              />
            </div>

            {/* Reasoning */}
            <div>
              <h4 className="font-medium mb-3">AI Reasoning</h4>
              <Reasoning title="Analysis Process" defaultOpen>
                Processing your transaction data by categorizing expenses and identifying spending patterns.
                Applying statistical analysis to detect trends and anomalies in your financial behavior.
                Calculating potential savings opportunities based on historical data and spending habits.
                Generating actionable insights for budget optimization and financial goals.
              </Reasoning>
            </div>

            {/* Sources */}
            <div>
              <h4 className="font-medium mb-3">Source Citations</h4>
              <Sources sources={[
                {
                  id: "1",
                  title: "Transaction Data",
                  description: "Real-time banking data from connected accounts",
                  relevance: 0.95,
                },
                {
                  id: "2",
                  title: "Historical Trends",
                  description: "12-month spending patterns and analysis",
                  relevance: 0.88,
                }
              ]} />
            </div>

            {/* Task Management */}
            <div>
              <h4 className="font-medium mb-3">Task Tracking</h4>
              <div className="space-y-2">
                <Task
                  task={{
                    id: "1",
                    title: "Analyze monthly spending",
                    description: "Process and categorize transactions by date range",
                    status: "completed",
                    priority: "high",
                    files: ["transactions.csv", "analytics.py"],
                    category: "analysis",
                    createdAt: new Date()
                  }}
                  onToggleStatus={() => {}}
                  onSelectFile={() => {}}
                />
                <Task
                  task={{
                    id: "2",
                    title: "Generate budget report",
                    description: "Create comprehensive budget analysis and recommendations",
                    status: "in-progress",
                    priority: "medium",
                    category: "planning",
                    createdAt: new Date()
                  }}
                  onToggleStatus={() => {}}
                  onSelectFile={() => {}}
                />
              </div>
            </div>

          </CardContent>
        </Card>
      )}

      {activeTab === "code" && (
        <Card>
          <CardHeader>
            <CardTitle>Code Block Examples</CardTitle>
          </CardHeader>
          <CardContent>
            <Message from="assistant" timestamp="Now">
              <MessageContent>
                <Response>Here are some code examples for financial analysis:

## Python Analysis Script
```python
import pandas as pd
import matplotlib.pyplot as plt

def analyze_spending(transactions_df):
    # Calculate monthly totals
    monthly_spending = transactions_df.groupby(
        transactions_df['date'].dt.month
    )['amount'].sum()

    # Find top spending categories
    category_spending = transactions_df.groupby('category')['amount'].sum()
    top_categories = category_spending.nlargest(5)

    # Calculate savings potential
    savings_opportunities = transactions_df[
        (transactions_df['category'] == 'Dining') &
        (transactions_df['amount'] > 50)
    ]

    metrics = {
        'average_daily': transactions_df['amount'].mean(),
        'total_spending': transactions_df['amount'].sum(),
        'top_categories': top_categories.to_dict(),
        'overspending_instances': len(savings_opportunities)
    }

    return metrics

# Usage example
transactions = pd.read_csv('transactions.csv')
analysis = analyze_spending(transactions)
print(f"Your average daily spending is ${analysis['average_daily']:.2f}")
```

## JavaScript Budget Calculator
```javascript
class BudgetCalculator {
  constructor(transactions) {
    this.transactions = transactions;
  }

  calculateMonthlyBudget() {
    const monthlyTotals = this.transactions.reduce((acc, t) => {
      const month = new Date(t.date).getMonth();
      acc[month] = (acc[month] || 0) + t.amount;
      return acc;
    }, {});

    return Object.entries(monthlyTotals).map(([month, total]) => ({
      month: parseInt(month),
      total: total,
      projectedBudget: total * 1.1 // 10% buffer
    }));
  }

  generateBudgetRecommendations() {
    const recommendations = [];
    const monthlyBudget = this.calculateMonthlyBudget();

    if (monthlyBudget.length > 0) {
      const averageMonthly = monthlyBudget.reduce((sum, m) =>
        sum + m.total, 0) / monthlyBudget.length;

      recommendations.push({
        type: 'info',
        title: 'Monthly Average',
        description: `Your average monthly spending is $${averageMonthly.toFixed(2)}`
      });

      if (averageMonthly > 3000) {
        recommendations.push({
          type: 'warning',
          title: 'High Spending Detected',
          description: 'Consider creating a detailed budget to manage expenses better'
        });
      }
    }

    return recommendations;
  }
}

// Usage
const calculator = new BudgetCalculator(sampleTransactions);
const budget = calculator.calculateMonthlyBudget();
const recommendations = calculator.generateBudgetRecommendations();
```

This code provides a foundation for comprehensive financial analysis! 📈</Response>
              </MessageContent>
            </Message>
          </CardContent>
        </Card>
      )}

      {activeTab === "actions" && (
        <Card>
          <CardHeader>
            <CardTitle>Interactive Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Suggestions */}
            <div>
              <h4 className="font-medium mb-3">Quick Suggestions</h4>
              <Suggestion
                suggestions={[
                  { id: "1", text: "Show me my spending trends", category: "analysis" },
                  { id: "2", text: "Create a savings plan", category: "action" },
                  { id: "3", text: "Analyze subscription costs", category: "question" },
                  { id: "4", text: "Review my financial goals", category: "question" },
                ]}
                onSelect={(suggestion) => console.log("Selected:", suggestion)}
                showCategories={true}
              />
            </div>

          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">🎉 Ready to Build Amazing AI Interfaces</h3>
            <p className="text-muted-foreground">
              All these components are already integrated into your `/private/vectr-ai` page and powered by Google Gemini AI!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}