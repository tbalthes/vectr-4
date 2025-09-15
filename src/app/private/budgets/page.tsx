'use client';
import React from 'react';

import { budgetData } from '@/data/budget-data';
import PageHeader from '@/components/private/PageHeader';
import BudgetCardList from '@/components/private/budgets/BudgetCardList';
import { CreateBudgetModal } from '@/components/private/budgets/CreateBudgetModal';
import { BudgetInsights } from '@/components/private/budgets/BudgetInsights';
import BudgetOverview from '@/components/private/budgets/BudgetOverview';

export default function Budgets() {
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);

  const totalBudget = budgetData.reduce((sum, budget) => sum + budget.budgetAmount, 0);
  const totalSpent = budgetData.reduce((sum, budget) => sum + budget.spentAmount, 0);
  const overallProgress = (totalSpent / totalBudget) * 100;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Budgets"
        subtitle="Manage and track your spending budgets"
        actions={<CreateBudgetModal open={isAddDialogOpen} setOpen={setIsAddDialogOpen} />}
      />

      {/* Budget Overview */}
      <BudgetOverview
        totalBudget={totalBudget}
        totalSpent={totalSpent}
        overallProgress={overallProgress}
      />

      {/* Budget Categories */}
      <BudgetCardList budgets={budgetData} />

      <BudgetInsights />
    </div>
  );
}
