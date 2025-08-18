"use client";

import { TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

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

export const description = "A stacked area chart with expand stacking";

const chartData = [
  { month: "January", fastfood: 186, groceries: 80, snacks: 45 },
  { month: "February", fastfood: 305, groceries: 200, snacks: 100 },
  { month: "March", fastfood: 237, groceries: 120, snacks: 150 },
  { month: "April", fastfood: 73, groceries: 190, snacks: 50 },
  { month: "May", fastfood: 209, groceries: 130, snacks: 100 },
  { month: "June", fastfood: 214, groceries: 140, snacks: 160 },
];

const chartConfig = {
  fastfood: {
    label: "Fast Food",
    color: "var(--chart-1)",
  },
  groceries: {
    label: "Groceries",
    color: "var(--chart-2)",
  },
  snacks: {
    label: "Snacks",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export function BudgetCompositionChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget Composition - Breakdown</CardTitle>
        <CardDescription>
          Showing total budget composition changes over the last 6 months
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
              top: 12,
            }}
            stackOffset="expand"
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
              content={<ChartTooltipContent indicator="line" />}
            />
            <Area
              dataKey="snacks"
              type="natural"
              fill="#351ee6" // Amber-400
              fillOpacity={0.1}
              stroke="#3b00b3"
              stackId="a"
            />
            <Area
              dataKey="groceries"
              type="natural"
              fill="#5703fc" // Emerald-400
              fillOpacity={0.4}
              stroke="#1e0059"
              stackId="a"
            />
            <Area
              dataKey="fastfood"
              type="natural"
              fill="#a13ec2" // Red-400
              fillOpacity={0.4}
              stroke="#580075"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 leading-none font-medium">
              Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
            </div>
            <div className="text-muted-foreground flex items-center gap-2 leading-none">
              January - June 2025
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
