import React from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";

interface BudgetOverviewProps {
  totalBudget: number;
  totalSpent: number;
  overallProgress: number;
}

const BudgetOverview: React.FC<BudgetOverviewProps> = ({
  totalBudget,
  totalSpent,
  overallProgress,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <Card>
      <CardContent className="p-4">
        <div className="text-lg font-semibold mb-1 text-black">
          Total Budget
        </div>
        <div className="text-2xl font-bold text-violet-700">
          ${totalBudget.toFixed(2)}
        </div>
        <div className="text-sm mt-1 text-gray-600">This month</div>
      </CardContent>
    </Card>
    <Card>
      <CardContent className="p-4">
        <div className="text-lg font-semibold mb-1 text-black">Total Spent</div>
        <div className="text-2xl font-bold text-red-600">
          ${totalSpent.toFixed(2)}
        </div>
        <div className="mt-2">
          <Progress value={overallProgress} />
        </div>
        <div className="text-sm mt-1 text-gray-600">
          {overallProgress.toFixed(1)}% of budget used
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent className="p-4">
        <div className="text-lg font-semibold mb-1 text-black">Remaining</div>
        <div className="text-2xl font-bold text-green-600">
          ${(totalBudget - totalSpent).toFixed(2)}
        </div>
        <div className="text-sm mt-1 text-gray-600">
          15 days left this month
        </div>
      </CardContent>
    </Card>
  </div>
);

export default BudgetOverview;
