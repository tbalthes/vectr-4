import React from "react";
import { AlertTriangle, TrendingUp, CheckCircle, Target } from "lucide-react";

interface BudgetStatusIconProps {
  status: string;
}

const BudgetStatusIcon: React.FC<BudgetStatusIconProps> = ({ status }) => {
  switch (status) {
    case "over-budget":
      return <AlertTriangle className="h-4 w-4" />;
    case "on-track":
      return <TrendingUp className="h-4 w-4" />;
    case "under-budget":
      return <CheckCircle className="h-4 w-4" />;
    default:
      return <Target className="h-4 w-4" />;
  }
};

export default BudgetStatusIcon;
