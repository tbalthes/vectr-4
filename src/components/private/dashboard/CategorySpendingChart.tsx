"use client";

import { TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export const description = "A line chart with step";

const chartData = [
  { month: "January", category: 186 },
  { month: "February", category: 305 },
  { month: "March", category: 237 },
  { month: "April", category: 73 },
  { month: "May", category: 209 },
  { month: "June", category: 214 },
];

const chartConfig = {
  category: {
    label: "category",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function CategorySpending() {
  return (
    <Card className="bg-background text-foreground p-4 md:p-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">
          Monthly Spending - Single Category
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          January - June 2025
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
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
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
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
      <CardFooter className="pt-0 flex-col items-start gap-2 text-sm">
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
