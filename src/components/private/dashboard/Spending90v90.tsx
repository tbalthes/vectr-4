"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { subDays, subMonths, format, startOfMonth, endOfMonth } from "date-fns";

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

// --- Step 1: Use the realistic transaction data ---
const transactionData = [
  // August 2025
  { date: "2025-08-29", amount: 2400.0 },
  { date: "2025-08-28", amount: -42.8 },
  { date: "2025-08-26", amount: -180.0 },
  { date: "2025-08-23", amount: -99.0 },
  { date: "2025-08-21", amount: -12.0 },
  { date: "2025-08-18", amount: -260.0 },
  { date: "2025-08-15", amount: -240.0 },
  { date: "2025-08-15", amount: -35.5 },
  { date: "2025-08-14", amount: -150.0 },
  { date: "2025-08-11", amount: -75.0 },
  { date: "2025-08-08", amount: -22.9 },
  { date: "2025-08-07", amount: -390.0 },
  { date: "2025-08-04", amount: -68.0 },
  { date: "2025-08-01", amount: -105.0 },
  // July 2025
  { date: "2025-07-30", amount: -250.0 },
  { date: "2025-07-29", amount: -125.0 },
  { date: "2025-07-27", amount: -55.0 },
  { date: "2025-07-25", amount: -310.0 },
  { date: "2025-07-23", amount: -22.5 },
  { date: "2025-07-21", amount: -89.0 },
  { date: "2025-07-19", amount: -18.0 },
  { date: "2025-07-17", amount: -175.0 },
  { date: "2025-07-15", amount: -250.0 },
  { date: "2025-07-15", amount: -20.0 },
  { date: "2025-07-13", amount: -98.0 },
  { date: "2025-07-11", amount: -45.0 },
  { date: "2025-07-08", amount: -28.0 },
  { date: "2025-07-07", amount: -400.0 },
  { date: "2025-07-07", amount: -72.0 },
  { date: "2025-07-08", amount: -19.5 },
  { date: "2025-07-02", amount: -89.0 },
  { date: "2025-07-02", amount: -18.0 },
  { date: "2025-07-02", amount: -175.0 },
  // June 2024
  { date: "2025-06-30", amount: -250.0 },
  { date: "2025-06-30", amount: -75.5 },
  { date: "2025-06-29", amount: -120.0 },
  { date: "2025-06-28", amount: -45.2 },
  { date: "2025-06-27", amount: -15.8 },
  { date: "2025-06-25", amount: -210.8 },
  { date: "2025-06-24", amount: -85.6 },
  { date: "2025-06-22", amount: -88.0 },
  { date: "2025-06-21", amount: -35.0 },
  { date: "2025-06-20", amount: -50.0 },
  { date: "2025-06-18", amount: -150.0 },
  { date: "2025-06-17", amount: -22.45 },
  { date: "2025-06-15", amount: -250.0 },
  { date: "2025-06-15", amount: -300.0 },
  { date: "2025-06-14", amount: -18.9 },
  { date: "2025-06-12", amount: -32.75 },
  { date: "2025-06-10", amount: -12.5 },
  { date: "2025-06-08", amount: -95.0 },
  { date: "2025-06-07", amount: -400.0 },
  { date: "2025-06-05", amount: -240.0 },
  { date: "2025-06-03", amount: -65.2 },
  { date: "2025-06-01", amount: -55.0 },
  // May 2025
  { date: "2025-05-30", amount: -250.0 },
  { date: "2025-05-29", amount: -18.5 },
  { date: "2025-05-28", amount: -78.9 },
  { date: "2025-05-26", amount: -110.0 },
  { date: "2025-05-24", amount: -42.0 },
  { date: "2025-05-22", amount: -250.0 },
  { date: "2025-05-20", amount: -15.0 },
  { date: "2025-05-18", amount: -60.0 },
  { date: "2025-05-15", amount: -250.0 },
  { date: "2025-05-15", amount: -280.0 },
  { date: "2025-05-14", amount: -33.1 },
  { date: "2025-05-11", amount: -130.0 },
  { date: "2025-05-09", amount: -25.0 },
  { date: "2025-05-07", amount: -400.0 },
  { date: "2025-05-05", amount: -90.0 },
  { date: "2025-05-08", amount: -19.8 },
  { date: "2025-05-01", amount: -62.3 },
  // April 2025
  { date: "2025-04-30", amount: -250.0 },
  { date: "2025-04-29", amount: -125.0 },
  { date: "2025-04-27", amount: -55.0 },
  { date: "2025-04-25", amount: -310.0 },
  { date: "2025-04-23", amount: -22.5 },
  { date: "2025-04-21", amount: -89.0 },
  { date: "2025-04-19", amount: -18.0 },
  { date: "2025-04-17", amount: -175.0 },
  { date: "2025-04-15", amount: 2500.0 },
  { date: "2025-04-15", amount: -20.0 },
  { date: "2025-04-13", amount: -98.0 },
  { date: "2025-04-11", amount: -45.0 },
  { date: "2025-04-08", amount: -28.0 },
  { date: "2025-04-04", amount: -400.0 },
  { date: "2025-04-04", amount: -72.0 },
  { date: "2025-04-08", amount: -19.5 },
  // March 2025
  { date: "2025-03-31", amount: -245.0 },
  { date: "2025-03-30", amount: -88.0 },
  { date: "2025-03-28", amount: -12.75 },
  { date: "2025-03-26", amount: -215.5 },
  { date: "2025-03-23", amount: -45.0 },
  { date: "2025-03-21", amount: -95.3 },
  { date: "2025-03-19", amount: -32.0 },
  { date: "2025-03-15", amount: 2450.0 },
  { date: "2025-03-15", amount: -450.0 },
  { date: "2025-03-12", amount: -120.0 },
  { date: "2025-03-10", amount: -15.0 },
  { date: "2025-03-07", amount: -380.0 },
  { date: "2025-03-05", amount: -76.0 },
  { date: "2025-03-08", amount: -21.25 },
  // February 2025
  { date: "2025-02-29", amount: -240.0 },
  { date: "2025-02-28", amount: -42.8 },
  { date: "2025-02-26", amount: -180.0 },
  { date: "2025-02-23", amount: -99.0 },
  { date: "2025-02-21", amount: -12.0 },
  { date: "2025-02-18", amount: -260.0 },
  { date: "2025-02-15", amount: 2400.0 },
  { date: "2025-02-15", amount: -35.5 },
  { date: "2025-02-14", amount: -150.0 },
  { date: "2025-02-11", amount: -75.0 },
  { date: "2025-02-02", amount: -22.9 },
  { date: "2025-02-07", amount: -390.0 },
  { date: "2025-02-04", amount: -68.0 },
  { date: "2025-02-01", amount: -105.0 },
];

// --- Step 2: Define the data processing logic ---
const calculateDailySpendingComparison = (
  data: { date: string; amount: number }[]
) => {
  const today = new Date();
  const endDateCurrent = today;
  const startDateCurrent = subDays(today, 89); // 90 days including today
  const endDatePrevious = subDays(today, 90);
  const startDatePrevious = subDays(today, 179);

  // Helper to get all days in a range
  function getDateRange(start: Date, end: Date) {
    const arr = [];
    const dt = new Date(start);
    while (dt <= end) {
      arr.push(format(dt, "yyyy-MM-dd"));
      dt.setDate(dt.getDate() + 1);
    }
    return arr;
  }

  // Aggregate spending per day for a given range
  function spendingByDay(start: Date, end: Date) {
    const days = getDateRange(start, end);
    const map = days.reduce((acc, d) => {
      acc[d] = 0;
      return acc;
    }, {} as Record<string, number>);
    data.forEach((tx) => {
      const txDate = format(new Date(tx.date), "yyyy-MM-dd");
      if (tx.amount < 0 && txDate in map) {
        map[txDate] += Math.abs(tx.amount);
      }
    });
    return map;
  }

  const currentSpending = spendingByDay(startDateCurrent, endDateCurrent);
  const previousSpending = spendingByDay(startDatePrevious, endDatePrevious);

  // Build chart data for each period
  const currentDates = getDateRange(startDateCurrent, endDateCurrent);
  const previousDates = getDateRange(startDatePrevious, endDatePrevious);
  const currentChartData = currentDates.map((date) => ({
    date,
    value: currentSpending[date] || 0,
  }));
  const previousChartData = previousDates.map((date) => ({
    date,
    value: previousSpending[date] || 0,
  }));

  return {
    currentChartData,
    previousChartData,
    totalCurrent: Object.values(currentSpending).reduce(
      (sum, val) => sum + val,
      0
    ),
    totalPrevious: Object.values(previousSpending).reduce(
      (sum, val) => sum + val,
      0
    ),
  };
};

// --- Step 3: Update Chart Configuration ---
const chartConfig = {
  current: {
    label: "Last 90 Days",
    color: "hsl(var(--chart-1))",
  },
  previous: {
    label: "Previous 90 Days",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function Spending90v90() {
  const [data] = React.useState(() =>
    calculateDailySpendingComparison(transactionData)
  );
  const [activeChart, setActiveChart] = React.useState<"current" | "previous">(
    "current"
  );

  const total = {
    current: data.totalCurrent,
    previous: data.totalPrevious,
  };

  // Pick the correct chart data and x-axis range for the selected period
  const chartData =
    activeChart === "current" ? data.currentChartData : data.previousChartData;

  // For legend: show the 3 months covered by the selected period
  const firstDate = chartData[0]?.date ? new Date(chartData[0].date) : null;
  const lastDate = chartData[chartData.length - 1]?.date
    ? new Date(chartData[chartData.length - 1].date)
    : null;
  const legendLabel =
    firstDate && lastDate
      ? `${firstDate.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })} - ${lastDate.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })}`
      : "";

  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>90 v. 90 Comparison</CardTitle>
          <CardDescription>
            Daily spending, Last 90 days vs. previous 90 day period
          </CardDescription>
        </div>
        <div className="flex">
          {(["current", "previous"] as const).map((key) => (
            <button
              key={key}
              data-active={activeChart === key}
              className="data-[active=true]:bg-muted/50 relative flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-l sm:border-t-0"
              onClick={() => setActiveChart(key)}
            >
              <span className="text-xs text-muted-foreground">
                {chartConfig[key].label}
              </span>
              <span className="text-lg font-bold leading-none sm:text-3xl">
                {total[key].toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                })}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  formatter={(value) => `$${Number(value).toLocaleString()}`}
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                  }}
                />
              }
            />
            <Bar
              dataKey="value"
              fill="#8b5cf6" // violet-500
              radius={4}
              barSize={32}
            />
          </BarChart>
        </ChartContainer>
        <div className="mt-2 text-xs text-muted-foreground text-center">
          {legendLabel}
        </div>
      </CardContent>
    </Card>
  );
}
