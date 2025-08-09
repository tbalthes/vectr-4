import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Plus,
  Download,
  Filter,
  Calendar
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const spendingData = [
  { month: 'Jan', spending: 2400, income: 4000 },
  { month: 'Feb', spending: 2600, income: 4200 },
  { month: 'Mar', spending: 2200, income: 3800 },
  { month: 'Apr', spending: 2800, income: 4400 },
  { month: 'May', spending: 3200, income: 4800 },
  { month: 'Jun', spending: 2900, income: 4600 },
];

const categoryData = [
  { name: 'Food & Dining', value: 850, color: '#3b82f6' },
  { name: 'Transportation', value: 450, color: '#059669' },
  { name: 'Entertainment', value: 320, color: '#d97706' },
  { name: 'Utilities', value: 280, color: '#dc2626' },
  { name: 'Shopping', value: 180, color: '#7c3aed' },
  { name: 'Others', value: 320, color: '#6b7280' },
];

const recentTransactions = [
  { id: 1, description: 'Whole Foods Market', amount: -85.42, category: 'Food & Dining', date: '2 hours ago', type: 'expense' },
  { id: 2, description: 'Salary Deposit', amount: 3500.00, category: 'Income', date: 'Today', type: 'income' },
  { id: 3, description: 'Uber Ride', amount: -18.50, category: 'Transportation', date: 'Yesterday', type: 'expense' },
  { id: 4, description: 'Netflix Subscription', amount: -15.99, category: 'Entertainment', date: '2 days ago', type: 'expense' },
  { id: 5, description: 'Freelance Project', amount: 750.00, category: 'Income', date: '3 days ago', type: 'income' },
];

export function Dashboard() {
  return (
    <div className="flex-1 space-y-6 p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            Welcome back, John. Here's what's happening with your money.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm">
            <Calendar className="mr-2 h-4 w-4" />
            Last 30 days
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add transaction
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="card-clean card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted">Total Balance</p>
                <p className="text-2xl font-bold text-foreground">$12,450.32</p>
              </div>
              <div className="h-8 w-8 bg-success/10 rounded-lg flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-success" />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <TrendingUp className="h-3 w-3 text-success mr-1" />
              <span className="text-xs font-medium text-success">+8.2%</span>
              <span className="text-xs text-muted ml-2">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-clean card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted">Monthly Spending</p>
                <p className="text-2xl font-bold text-foreground">$2,890.45</p>
              </div>
              <div className="h-8 w-8 bg-destructive/10 rounded-lg flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-destructive" />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <TrendingDown className="h-3 w-3 text-success mr-1" />
              <span className="text-xs font-medium text-success">-2.1%</span>
              <span className="text-xs text-muted ml-2">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-clean card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted">Monthly Income</p>
                <p className="text-2xl font-bold text-foreground">$4,600.00</p>
              </div>
              <div className="h-8 w-8 bg-info/10 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4 text-info" />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <TrendingUp className="h-3 w-3 text-success mr-1" />
              <span className="text-xs font-medium text-success">+5.4%</span>
              <span className="text-xs text-muted ml-2">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-clean card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted">Savings Goal</p>
                <p className="text-2xl font-bold text-foreground">68%</p>
              </div>
              <div className="h-8 w-8 bg-warning/10 rounded-lg flex items-center justify-center">
                <PiggyBank className="h-4 w-4 text-warning" />
              </div>
            </div>
            <div className="mt-4">
              <Progress value={68} className="h-2" />
              <p className="text-xs text-muted mt-2">$6,800 of $10,000</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 card-clean">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">Income vs Spending</CardTitle>
                <CardDescription>Your financial flow over the last 6 months</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={spendingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(value) => `$${value/1000}k`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="income" 
                  stroke="#059669" 
                  strokeWidth={2}
                  dot={{ fill: '#059669', strokeWidth: 0, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="spending" 
                  stroke="#dc2626" 
                  strokeWidth={2}
                  dot={{ fill: '#dc2626', strokeWidth: 0, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-clean">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Spending by Category</CardTitle>
            <CardDescription>This month's expenses breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [`$${value}`, 'Amount']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-4">
              {categoryData.slice(0, 4).map((category, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-foreground-muted">{category.name}</span>
                  </div>
                  <span className="font-medium text-foreground">${category.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="card-clean">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Recent Transactions</CardTitle>
              <CardDescription>Your latest financial activity</CardDescription>
            </div>
            <Button variant="outline" size="sm">View all</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-border-light last:border-0">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    transaction.type === 'income' 
                      ? 'bg-success/10 text-success' 
                      : 'bg-destructive/10 text-destructive'
                  }`}>
                    {transaction.type === 'income' ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{transaction.description}</p>
                    <p className="text-xs text-muted">{transaction.category} • {transaction.date}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-semibold ${
                    transaction.amount > 0 ? 'text-success' : 'text-foreground'
                  }`}>
                    {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                  </span>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}