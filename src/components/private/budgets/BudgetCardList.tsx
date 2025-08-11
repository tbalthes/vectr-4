import React from "react";
import { Budget } from "@/types/budgets";
import { BudgetCard } from "@/components/private/budgets/BudgetCard";
import { getStatusColor } from "@/components/private/budgets/budget-utils";
import BudgetStatusIcon from "@/components/private/budgets/BudgetStatusIcon";

interface BudgetCardListProps {
  budgets: Budget[];
}

const BudgetCardList: React.FC<BudgetCardListProps> = ({ budgets }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {budgets.map((budget) => (
      <BudgetCard
        key={budget.id}
        budget={budget}
        getStatusColor={getStatusColor}
        getStatusIcon={(status: string) => <BudgetStatusIcon status={status} />}
      />
    ))}
  </div>
);

export default BudgetCardList;
