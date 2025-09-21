'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { subDays, format } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { useAnalytics } from '@/hooks/useAnalytics';

const chartConfig = {
  current: {
    label: 'Last 90 Days',
    color: 'hsl(var(--chart-1))',
  },
  previous: {
    label: 'Previous 90 Days',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

export function Spending90v90() {
  // Compute the date ranges (90-day windows) and format for API
  const today = new Date();
  const startDateCurrent = subDays(today, 89);
  const endDateCurrent = today;
  const startDatePrevious = subDays(today, 179);
  const endDatePrevious = subDays(today, 90);
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

  // Use the shared useAnalytics hook with explicit start/end dates
  const {
    data: rpcCurrent,
    loading: loadingCurrent,
    error: errorCurrent,
  } = useAnalytics('90d', fmt(startDateCurrent), fmt(endDateCurrent));
  const {
    data: rpcPrevious,
    loading: loadingPrevious,
    error: errorPrevious,
  } = useAnalytics('90d', fmt(startDatePrevious), fmt(endDatePrevious));

  const [activeChart, setActiveChart] = React.useState<'current' | 'previous'>('current');

  // Build chart arrays from API data
  const currentChartData = React.useMemo(() => {
    if (!rpcCurrent?.length) {
      return [];
    }
    return rpcCurrent.map((r) => ({
      date: r.bucket,
      value: Number(r.spending ?? 0),
    }));
  }, [rpcCurrent]);

  const previousChartData = React.useMemo(() => {
    if (!rpcPrevious?.length) {
      return [];
    }
    return rpcPrevious.map((r) => ({
      date: r.bucket,
      value: Number(r.spending ?? 0),
    }));
  }, [rpcPrevious]);

  // Calculate totals
  const total = React.useMemo(
    () => ({
      current: currentChartData.reduce((sum, item) => sum + item.value, 0),
      previous: previousChartData.reduce((sum, item) => sum + item.value, 0),
    }),
    [currentChartData, previousChartData],
  );

  // Pick the correct chart data for the selected period
  const chartData = activeChart === 'current' ? currentChartData : previousChartData;
  const loading = activeChart === 'current' ? loadingCurrent : loadingPrevious;
  const error = activeChart === 'current' ? errorCurrent : errorPrevious;

  // For legend: show the 3 months covered by the selected period
  const parseLocal = (d: string | undefined | null) => {
    if (!d) {
      return null;
    }
    const s = String(d);
    return new Date(s.includes('T') ? s : s + 'T00:00:00');
  };

  const firstDate = parseLocal(chartData[0]?.date ?? null);
  const lastDate = parseLocal(chartData[chartData.length - 1]?.date ?? null);
  const legendLabel =
    firstDate && lastDate
      ? `${firstDate.toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })} - ${lastDate.toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })}`
      : '';

  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>90 v. 90 Comparison</CardTitle>
          <CardDescription>Daily spending, Last 90 days vs. previous 90 day period</CardDescription>
        </div>
        <div className="flex">
          {(['current', 'previous'] as const).map((key) => (
            <button
              key={key}
              data-active={activeChart === key}
              className="data-[active=true]:bg-muted/50 relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-l sm:border-t-0"
              onClick={() => setActiveChart(key)}
            >
              <span className="text-xs text-muted-foreground">{chartConfig[key].label}</span>
              <span className="text-lg font-bold leading-none sm:text-3xl">
                {loading
                  ? '...'
                  : total[key].toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      maximumFractionDigits: 0,
                    })}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            Loading data...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[250px] text-destructive">
            Error loading data: {String(error)}
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            No data available for this period
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <BarChart accessibilityLayer data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  // Parse bucket (YYYY-MM-DD) as local date to avoid UTC shift
                  const str = String(value ?? '');
                  const date = new Date(str.includes('T') ? str : str + 'T00:00:00');
                  return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
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
                      // Ensure ISO bucket strings (YYYY-MM-DD) are treated as local dates
                      const str = String(value ?? '');
                      const date = new Date(str.includes('T') ? str : str + 'T00:00:00');
                      return date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
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
        )}
        {chartData.length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground text-center">{legendLabel}</div>
        )}
      </CardContent>
    </Card>
  );
}
