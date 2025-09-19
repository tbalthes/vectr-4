import React from 'react';
import { Filter } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SpendingData {
  month: string;
  income: number;
  spending: number;
}

interface IncomeVsSpendingProps {
  data: SpendingData[];
}

export function IncomeVsSpending({ data }: IncomeVsSpendingProps) {
  return (
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
          <LineChart data={data}>
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
              tickFormatter={(value) => `$${value / 1000}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
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
  );
}
