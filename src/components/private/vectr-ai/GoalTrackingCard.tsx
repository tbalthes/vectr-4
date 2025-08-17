"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { FinancialGoal } from "@/types/vectrai";

interface GoalTrackingCardProps {
  financialGoals: FinancialGoal[];
  getStatusColor: (status: string) => string;
}

export default function GoalTrackingCard({
  financialGoals,
  getStatusColor,
}: GoalTrackingCardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {financialGoals.map((goal) => {
        const progress = (goal.current / goal.target) * 100;
        const remaining = goal.target - goal.current;
        return (
          <Card key={goal.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{goal.title}</CardTitle>
                <Badge className={`text-xs ${getStatusColor(goal.status)}`}>
                  {goal.status.replace("-", " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">
                      ${goal.current} / ${goal.target}
                    </span>
                  </div>
                  <Progress value={Math.min(progress, 100)} className="h-2" />
                  <p className="text-xs text-gray-500 mt-1">
                    {progress.toFixed(1)}% complete
                  </p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <div>
                    <p className="text-xs text-gray-500">Remaining</p>
                    <p className="font-medium">${remaining}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Deadline</p>
                    <p className="font-medium text-sm">{goal.deadline}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
