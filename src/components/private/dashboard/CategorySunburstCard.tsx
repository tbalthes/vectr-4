"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SpendingCategoryDonutChart from "./SpendingCategoryDonutChart";
import { type FlatCategoryRow } from "@/lib/analytics/toSunburst";
import { useEffect, useState } from "react";
import { type RangeKey } from "@/hooks/useAnalytics";

function useCategoryRows(range: string = "30d") {
  const [rows, setRows] = useState<FlatCategoryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
  const res = await fetch(`/api/analytics/aggregator?view=categories&range=${encodeURIComponent(range)}`, { credentials: "include" });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const body = await res.json();
        if (mounted) setRows((body?.data || []) as FlatCategoryRow[]);
      } catch (e) {
        if (mounted) setError(e as Error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [range]);
  return { rows, loading, error } as const;
}

export default function CategorySunburstCard() {
  const [range, setRange] = useState<RangeKey>("30d");
  const { rows, loading, error } = useCategoryRows(range);

  const total = (rows || []).reduce((s, r) => s + r.amount, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 space-y-0 border-b py-4 sm:flex-row">
          <div className="grid flex-1 gap-1">
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>Interactive donut chart of your expenses</CardDescription>
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
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-sm text-destructive">Failed to load categories</div>
        ) : rows == null || loading ? (
          <div className="h-64 animate-pulse rounded-md bg-muted" />
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No categorized spending in the selected range.</div>
        ) : (
          <SpendingCategoryDonutChart data={rows} />
        )}
      </CardContent>
    </Card>
  );
}
