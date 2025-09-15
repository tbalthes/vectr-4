"use client";

import React, { useMemo } from "react";

import SpendingCalendarHeatmap from "@/components/ui/DailySpendingHeatmap";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  useAnalytics,
  type AggregateRow,
  type RangeKey,
} from "@/hooks/useAnalytics";

export type ScaleMode = "absolute" | "percentile" | "log";

interface Props {
  range?: RangeKey; // default 1Y for calendar view
  start?: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD
  mode?: ScaleMode;
  height?: number;
}

/**
 * High-level spending heatmap powered by the Analytics Aggregator API.
 * - calendar: daily calendar heatmap for the selected range (default 1Y)
 * - month: aggregate per month (avg daily spend), displayed as 12 columns heatmap
 * - weekday: average spend by weekday across the date range
 */
export default function SpendingHeatmap({
  range = "1Y",
  start,
  end,
  mode = "percentile",
  height = 240,
}: Props) {
  const { data, loading, error } = useAnalytics(range, start, end);

  // Map API rows to calendar [date, value]
  const calendarData: [string, number][] = useMemo(() => {
    if (!data) {return [];}
    return data.map((r: AggregateRow) => [r.bucket, Number(r.spending || 0)]);
  }, [data]);

  // Compute a safe calendar range from data (min..max date strings)
  const yearOrRange = useMemo(() => {
    if (!data || data.length === 0) {return undefined;}
    let min = data[0].bucket;
    let max = data[0].bucket;
    for (const r of data) {
      if (r.bucket < min) {min = r.bucket;}
      if (r.bucket > max) {max = r.bucket;}
    }
    return [min, max] as [string, string];
  }, [data]);

  // Future matrix variants (month/weekday) can be added in a follow-up.

  const body = (
    <SpendingCalendarHeatmap
      data={calendarData}
      mode={mode}
      height={height}
      yearOrRange={yearOrRange}
    />
  );

  return (
    <Card className="p-4 sm:p-6 lg:p-8">
      <CardHeader>
        <CardTitle>Daily Spending Heatmap</CardTitle>
        <CardDescription>
          A year view highlighting which days you spend the most.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading && (
          <div className="w-full" style={{ height }}>
            <div className="h-full w-full animate-pulse rounded-md bg-[color:var(--muted)]/20" />
          </div>
        )}
        {!loading && error && (
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Failed to load analytics.
          </div>
        )}
        {!loading && !error && (!data || data.length === 0) && (
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            No data for this period.
          </div>
        )}
        {!loading && !error && data && data.length > 0 && body}
      </CardContent>
    </Card>
  );
}
