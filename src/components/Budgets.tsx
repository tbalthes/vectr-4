import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Target,
  AlertTriangle,
  CheckCircle,
  Edit,
  Trash2,
  MoreHorizontal
} from 'lucide-react';

const budgetData = [
  {
    id: 1,
    category: 'Food & Dining',
    budgetAmount: 800,
    spentAmount: 650,
    period: 'Monthly',
    color: '#8B5CF6',
    status: 'on-track',
    daysLeft: 15
  },
  {
    id: 2,
    category: 'Transportation',
    budgetAmount: 300,
    spentAmount: 320,
    period: 'Monthly',
    color: '#06B6D4',
    status: 'over-budget',
    daysLeft: 15
  },
  {
    id: 3,
    category: 'Entertainment',
    budgetAmount: 200,
    spentAmount: 180,
    period: 'Monthly',
    color: '#F59E0B',
    status: 'on-track',
    daysLeft: 15
  },
  {
    id: 4,
    category: 'Shopping',
    budgetAmount: 400,
    spentAmount: 125,
    period: 'Monthly',
    color: '#10B981',
    status: 'under-budget',
    daysLeft: 15
  },
  {
    id: 5,
    category: 'Utilities',
    budgetAmount: 250,
    spentAmount: 220,
    period: 'Monthly',
    color: '#EF4444',
    status: 'on-track',
    daysLeft: 15
  },
  {
    id: 6,
    category: 'Healthcare',
    budgetAmount: 300,
    spentAmount: 85,
    period: 'Monthly',
    color: '#84CC16',
    status: 'under-budget',
    daysLeft: 15
  }
];

export function Budgets() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const totalBudget = budgetData.reduce((sum, budget) => sum + budget.budgetAmount, 0);
  const totalSpent = budgetData.reduce((sum, budget) => sum + budget.spentAmount, 0);
  const overallProgress = (totalSpent / totalBudget) * 100;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'over-budget':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'on-track':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'under-budget':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'over-budget':
        return <AlertTriangle className="h-4 w-4" />;
      case 'on-track':
        return <TrendingUp className="h-4 w-4" />;
      case 'under-budget':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Budgets</h1>
          <p className="text-gray-600 mt-1">Manage and track your spending budgets</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Budget
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Budget</DialogTitle>
              <DialogDescription>
                Set up a new budget to track your spending in a specific category.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="food">Food & Dining</SelectItem>
                    <SelectItem value="transport">Transportation</SelectItem>
                    <SelectItem value="entertainment">Entertainment</SelectItem>
                    <SelectItem value="shopping">Shopping</SelectItem>
                    <SelectItem value="utilities">Utilities</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">Budget Amount</Label>
                <Input id="amount" type="number" placeholder="0.00" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="period">Period</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setIsAddDialogOpen(false)}>
                Create Budget
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">${totalBudget.toFixed(2)}</div>
            <p className="text-sm text-gray-600 mt-1">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${totalSpent.toFixed(2)}</div>
            <Progress value={overallProgress} className="mt-2" />
            <p className="text-sm text-gray-600 mt-1">{overallProgress.toFixed(1)}% of budget used</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${(totalBudget - totalSpent).toFixed(2)}</div>
            <p className="text-sm text-gray-600 mt-1">15 days left this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {budgetData.map((budget) => {
          const progress = (budget.spentAmount / budget.budgetAmount) * 100;
          const remaining = budget.budgetAmount - budget.spentAmount;
          
          return (
            <Card key={budget.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{budget.category}</CardTitle>
                    <CardDescription className="flex items-center mt-1">
                      <Badge className={`mr-2 text-xs ${getStatusColor(budget.status)}`}>
                        {getStatusIcon(budget.status)}
                        <span className="ml-1 capitalize">{budget.status.replace('-', ' ')}</span>
                      </Badge>
                      {budget.period}
                    </CardDescription>
                  </div>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Spent</span>
                    <span className="font-medium">${budget.spentAmount.toFixed(2)}</span>
                  </div>
                  <Progress 
                    value={Math.min(progress, 100)} 
                    className="h-2"
                    style={{
                      '--progress-background': budget.color
                    } as React.CSSProperties}
                  />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Budget</span>
                    <span className="font-medium">${budget.budgetAmount.toFixed(2)}</span>
                  </div>
                  
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        {remaining >= 0 ? 'Remaining' : 'Over budget'}
                      </span>
                      <span className={`font-semibold ${
                        remaining >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${Math.abs(remaining).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-500">
                        {budget.daysLeft} days left
                      </span>
                      <span className="text-xs text-gray-500">
                        {progress.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Budget Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Insights</CardTitle>
          <CardDescription>Tips to help you stay on track</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Transportation Budget Alert</p>
                <p className="text-sm text-yellow-700">You've exceeded your transportation budget by $20. Consider using public transit or carpooling.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">Great Job on Shopping!</p>
                <p className="text-sm text-green-700">You're well under budget for shopping this month. You have $275 remaining to spend.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800">Budget Optimization Tip</p>
                <p className="text-sm text-blue-700">Based on your spending patterns, consider increasing your food budget by $100 and decreasing entertainment by $50.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}