"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { format, subDays } from "date-fns"

import { transactionData } from "@/data/dashboard-data"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// --- Step 2: Create a data processing function ---
// This function aggregates the raw transactions into daily income and spending totals,
// which is the format the chart component needs.
const processDataForChart = (data: { date: string; amount: number }[]) => {
  const dailyTotals = data.reduce((acc, { date, amount }) => {
    if (!acc[date]) {
      acc[date] = { date, income: 0, spending: 0 };
    }
    if (amount > 0) {
      acc[date].income += amount;
    } else {
      acc[date].spending += Math.abs(amount);
    }
    return acc;
  }, {} as Record<string, { date: string; income: number; spending: number }>);

  return Object.values(dailyTotals).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

// Removed: processedChartData is now computed inside the component using the prop

// --- Step 3: Update Chart Configuration for Income & Spending ---
const chartConfig = {
  income: {
    label: "Income",
    theme: {
      light: "oklch(0.6 0.118 184.704)",
      dark: "oklch(0.696 0.17 162.48)",
    }
  },
  spending: {
    label: "Spending",
    theme: {
      light: "oklch(0.646 0.222 41.116)",
      dark: "oklch(0.488 0.243 264.376)",
    }
  },
} satisfies ChartConfig

export function IncomeSpendingOverTimeChart({ transactionData }: { transactionData: { date: string; amount: number }[] }) {
  const [timeRange, setTimeRange] = React.useState("30d")

  const processedChartData = React.useMemo(
    () => processDataForChart(transactionData),
    [transactionData]
  );

  const filteredData = React.useMemo(() => {
    const today = new Date();
    let daysToSubtract = 90;
    if (timeRange === "30d") {
      daysToSubtract = 30;
    } else if (timeRange === "7d") {
      daysToSubtract = 7;
    }
    const startDate = subDays(today, daysToSubtract);

    return processedChartData.filter((item) => new Date(item.date) >= startDate);
  }, [timeRange, processedChartData]);

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>Income vs. Spending</CardTitle>
          <CardDescription>
            Showing total income and spending over time
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="90d" className="rounded-lg">
              Last 90 days
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Last 30 days
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Last 7 days
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              {/* Gradient for the Spending area */}
              <linearGradient id="fillSpending" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-spending)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-spending)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              {/* Gradient for the Income area */}
              <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-income)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-income)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => format(new Date(value), "MMM d")}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => format(new Date(value), "MMM d, yyyy")}
                  indicator="dot"
                  formatter={(value, name) => 
                    `$${Number(value).toLocaleString()}`
                  }
                />
              }
            />
            {/* --- Step 4: Update Area components to use new data keys --- */}
            <Area
              dataKey="spending"
              type="natural"
              fill="url(#fillSpending)"
              stroke="var(--color-spending)"
            />
            <Area
              dataKey="income"
              type="natural"
              fill="url(#fillIncome)"
              stroke="var(--color-income)"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}