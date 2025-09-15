'use client';

import { TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, XAxis } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export const description = 'A line chart with step';

const chartData = [
  { month: 'January', category: 186 },
  { month: 'February', category: 305 },
  { month: 'March', category: 237 },
  { month: 'April', category: 73 },
  { month: 'May', category: 209 },
  { month: 'June', category: 214 },
];

const chartConfig = {
  category: {
    label: 'category',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export function CategorySpending() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Spending - Single Category</CardTitle>
        <CardDescription>January - June 2025</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Line
              dataKey="category"
              type="step"
              stroke="var(--color-category)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Showing total spending by category for the first half of 2025
        </div>
      </CardFooter>
    </Card>
  );
}
