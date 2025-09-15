"use client";

import * as React from "react";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format, subDays, subMonths, subYears, startOfYear } from "date-fns";

import { useAnalytics, type RangeKey } from "@/hooks/useAnalytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent, type ChartConfig
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
  const [range, setRange] = useState<RangeKey>("30d");
  const { data } = useAnalytics(range);
  // active series state: control which series are shown
  const [activeSeries, setActiveSeries] = React.useState<
    Record<string, boolean>
  >({
    income: true,
    spending: true,
  });

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
    console.debug(
      "[IncomeSpendingOverTime] chartDataMemo preview",
      chartDataMemo.slice?.(0, 20)
    );
  }

  const filteredData = React.useMemo(() => {
    const today = new Date();

    // If range is 'all', try to find the earliest non-empty bucket and start there
    if (range === "all") {
      const firstNonZero = chartDataMemo.find(
        (r) => (Number(r.income) || Number(r.spending)) !== 0
      );
      if (firstNonZero) {
        const d = String(firstNonZero.date ?? "");
        const start = new Date(d.includes("T") ? d : d + "T00:00:00");
        return chartDataMemo.filter((item) => {
          const itmDate = new Date(
            String(item.date ?? "").includes("T")
              ? String(item.date)
              : String(item.date) + "T00:00:00"
          );
          return itmDate >= start;
        });
      }

      // if no non-zero buckets exist, fall back to returning everything
      return chartDataMemo;
    }

    let startDate: Date;

    switch (range) {
      case "7d":
        startDate = subDays(today, 7);
        break;
      case "30d":
        startDate = subDays(today, 30);
        break;
      case "90d":
        startDate = subDays(today, 90);
        break;
      case "1M":
        startDate = subMonths(today, 1);
        break;
      case "3M":
        startDate = subMonths(today, 3);
        break;
      case "6M":
        startDate = subMonths(today, 6);
        break;
      case "YTD":
        startDate = startOfYear(today);
        break;
      case "1Y":
        startDate = subYears(today, 1);
        break;
      default:
        // fallback to 90 days
        startDate = subDays(today, 90);
    }

    return chartDataMemo.filter((item) => {
      const d = String(item.date ?? "");
      const date = new Date(d.includes("T") ? d : d + "T00:00:00");
      return date >= startDate;
    });
  }, [range, chartDataMemo]);

  // compute visible domain for Y axis based on active series
  const yDomain = React.useMemo(() => {
    const keys = Object.keys(activeSeries).filter((k) => activeSeries[k]);
    if (!keys.length) {return [0, 1];}

    let min = Infinity;
    let max = -Infinity;

    for (const row of filteredData) {
      for (const k of keys) {
        const v = Number((row as Record<string, unknown>)[k] ?? 0);
        if (Number.isFinite(v)) {
          if (v < min) {min = v;}
          if (v > max) {max = v;}
        }
      }
    }

    if (min === Infinity || max === -Infinity) {return [0, 1];}

    // add small padding
    const padding = Math.max((max - min) * 0.08, 1);
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [filteredData, activeSeries]);

  const handleToggleSeries = (key: string) => {
    setActiveSeries((s) => ({ ...s, [key]: !s[key] }));
  };

  // create modified data so hidden series animate to zero instead of unmounting
  const animatedData = React.useMemo(() => {
    return filteredData.map((r) => ({
      ...r,
      spending: activeSeries.spending ? r.spending : 0,
      income: activeSeries.income ? r.income : 0,
    }));
  }, [filteredData, activeSeries]);

  function formatYAxisTick(value: number) {
    const abs = Math.abs(value);
    if (abs >= 1000000) {return `$${(value / 1000000).toFixed(1)}M`;}
    if (abs >= 1000) {return `$${(value / 1000).toFixed(1)}k`;}
    return `$${value.toLocaleString()}`;
  }

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>Income vs. Spending</CardTitle>
          <CardDescription>
            Showing total income and spending over time
          </CardDescription>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="7d" className="rounded-lg">
              1 week
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              1 month
            </SelectItem>
            <SelectItem value="90d" className="rounded-lg">
              3 months
            </SelectItem>
            <SelectItem value="6M" className="rounded-lg">
              6 months
            </SelectItem>
            <SelectItem value="YTD" className="rounded-lg">
              Year to date
            </SelectItem>
            <SelectItem value="1Y" className="rounded-lg">
              1 year
            </SelectItem>
            <SelectItem value="all" className="rounded-lg">
              All time
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-5">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto  h-[300px] w-full pt-7"
        >
          <AreaChart data={animatedData}>
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
                const date = new Date(
                  str.includes("T") ? str : str + "T00:00:00"
                );
                return format(date, "MMM d");
              }}
            />
            {/* dynamic domain scales to visible series */}
            <YAxis
              domain={yDomain}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6b7280", fontSize: 12 }}
              tickFormatter={formatYAxisTick}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    format(
                      new Date(
                        String(value ?? "").includes("T")
                          ? String(value)
                          : String(value) + "T00:00:00"
                      ),
                      "MMM d, yyyy"
                    )
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
              isAnimationActive={true}
              animationDuration={420}
              animationEasing="ease"
              strokeOpacity={activeSeries.spending ? 1 : 0}
              fillOpacity={activeSeries.spending ? 1 : 0}
            />
            <Area
              dataKey="income"
              type="natural"
              fill="url(#fillIncome)"
              stroke="var(--color-income)"
              isAnimationActive={true}
              animationDuration={420}
              animationEasing="ease"
              strokeOpacity={activeSeries.income ? 1 : 0}
              fillOpacity={activeSeries.income ? 1 : 0}
            />
            <ChartLegend
              payload={[
                {
                  dataKey: "spending",
                  value: "spending",
                  color: "var(--color-spending)",
                },
                {
                  dataKey: "income",
                  value: "income",
                  color: "var(--color-income)",
                },
              ]}
              content={(props) => (
                <ChartLegendContent
                  payload={props?.payload}
                  verticalAlign={props?.verticalAlign}
                  onLegendToggle={handleToggleSeries}
                  activeKeys={activeSeries}
                />
              )}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
