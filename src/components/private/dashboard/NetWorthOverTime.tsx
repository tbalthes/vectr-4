"use client";

import { TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList } from "recharts";

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

export const description = "A bar chart with negative values";

const chartData = [
  { month: "January", networth: 186000 },
  { month: "February", networth: 205000 },
  { month: "March", networth: -207000 },
  { month: "April", networth: 173000 },
  { month: "May", networth: -209000 },
  { month: "June", networth: 214000 },
];

const chartConfig = {
  networth: {
    label: "networth",
  },
} satisfies ChartConfig;

export function NetWorthOverTime() {
  return (
    <Card className="bg-background text-foreground p-4 md:p-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">
          Net Worth - Over Time
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          January - Present
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel hideIndicator />}
            />
            <Bar dataKey="networth">
              <LabelList position="top" dataKey="month" fillOpacity={1} />
              {chartData.map((item) => (
                <Cell
                  key={item.month}
                  fill={item.networth > 0 ? "var(--chart-1)" : "var(--chart-2)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="pt-0 flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Showing total net worth for the last 6 months
        </div>
      </CardFooter>
    </Card>
  );
}
