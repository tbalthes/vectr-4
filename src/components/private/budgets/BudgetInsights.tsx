import React from 'react';
import { AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export function BudgetInsights() {
  return (
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
              <p className="text-sm text-yellow-700">
                You&#39;ve exceeded your transportation budget by $20. Consider using public transit
                or carpooling.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-green-800">Great Job on Shopping!</p>
              <p className="text-sm text-green-700">
                You&apos;re well under budget for shopping this month. You have $275 remaining to
                spend.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800">Budget Optimization Tip</p>
              <p className="text-sm text-blue-700">
                Based on your spending patterns, consider increasing your food budget by $100 and
                decreasing entertainment by $50.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
