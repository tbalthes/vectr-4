import React from 'react';
import { Edit, Trash2 } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { Budget } from '@/types/budgets';

interface BudgetCardProps {
  budget: Budget;
  getStatusColor: (status: string) => React.CSSProperties;
  getStatusIcon: (status: string) => React.ReactNode;
}

export function BudgetCard({ budget, getStatusColor, getStatusIcon }: BudgetCardProps) {
  const progress = (budget.spentAmount / budget.budgetAmount) * 100;
  const remaining = budget.budgetAmount - budget.spentAmount;

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg text-black font-semibold">{budget.category}</CardTitle>
            <CardDescription className="flex items-center mt-1">
              <Badge className="mr-2 text-xs" style={getStatusColor(budget.status)}>
                {getStatusIcon(budget.status)}
                <span className="ml-1 capitalize">{budget.status.replace('-', ' ')}</span>
              </Badge>
              <span className="text-gray-600 ml-2">{budget.period}</span>
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
            <span className="font-medium text-black">${budget.spentAmount.toFixed(2)}</span>
          </div>
          <Progress value={Math.min(progress, 100)} className="h-2" />
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Budget</span>
            <span className="font-medium text-black">${budget.budgetAmount.toFixed(2)}</span>
          </div>
          <div className="pt-2 border-t border-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                {remaining >= 0 ? 'Remaining' : 'Over budget'}
              </span>
              <span
                className={`font-semibold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                ${Math.abs(remaining).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {budget.daysLeft} days left
              </span>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {progress.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
