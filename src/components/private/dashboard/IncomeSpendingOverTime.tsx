"use client";

import * as React from "react";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { format, subDays } from "date-fns";

import { useAnalytics } from "@/hooks/useAnalytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// The chart consumes aggregated series returned by the analytics API.

// --- Step 3: Update Chart Configuration for Income & Spending ---
const chartConfig = {
  income: {
    label: "Income",
    theme: {
      light: "oklch(0.6 0.118 184.704)",
      dark: "oklch(0.696 0.17 162.48)",
    },
  },
  spending: {
    label: "Spending",
    theme: {
      light: "oklch(0.646 0.222 41.116)",
      dark: "oklch(0.488 0.243 264.376)",
    },
  },
} satisfies ChartConfig;

export default function IncomeSpendingOverTime() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const { data } = useAnalytics(range);

  const chartDataMemo = React.useMemo(
    () =>
      (data ?? []).map((r) => ({
        date: r.bucket,
        income: r.income,
        spending: r.spending,
      })),
    [data]
  );

  if (process.env.NODE_ENV === "development") {
    console.debug("[IncomeSpendingOverTime] chartDataMemo preview", chartDataMemo.slice?.(0, 20));
  }

  const filteredData = React.useMemo(() => {
    const today = new Date();
    let daysToSubtract = 90;
    if (range === "30d") {
      daysToSubtract = 30;
    } else if (range === "7d") {
      daysToSubtract = 7;
    }
    const startDate = subDays(today, daysToSubtract);

    return chartDataMemo.filter((item) => {
      const d = String(item.date ?? "");
      const date = new Date(d.includes("T") ? d : d + "T00:00:00");
      return date >= startDate;
    });
  }, [range, chartDataMemo]);

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>Income vs. Spending</CardTitle>
          <CardDescription>
            Showing total income and spending over time
          </CardDescription>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as "7d" | "30d" | "90d")}>
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
              tickFormatter={(value) => {
                const str = String(value ?? "");
                const date = new Date(str.includes("T") ? str : str + "T00:00:00");
                return format(date, "MMM d");
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    format(new Date(String(value ?? "").includes("T") ? String(value) : String(value) + "T00:00:00"), "MMM d, yyyy")
                  }
                  indicator="dot"
                  formatter={(value) => `$${Number(value).toLocaleString()}`}
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
  );
}
