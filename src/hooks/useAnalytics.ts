import { useEffect, useState, useCallback } from "react";

export type RangeKey =
  | "7d"
  | "30d"
  | "90d"
  | "1M"
  | "3M"
  | "6M"
  | "YTD"
  | "1Y"
  | "all";
export interface AggregateRow {
  bucket: string;
  income: number;
  spending: number;
  tx_count: number;
}
export interface AnalyticsResponse {
  data: AggregateRow[];
  metadata: Record<string, unknown>;
}

export function useAnalytics(
  range: RangeKey = "30d",
  start?: string,
  end?: string
) {
  const [data, setData] = useState<AggregateRow[] | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (!start || !end) params.set("range", range);
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      const url = `/api/analytics/aggregator?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const body: AnalyticsResponse = await res.json();
      setData(body.data);
      setMeta(body.metadata);
      if (process.env.NODE_ENV === "development") {
        // shallow preview to avoid huge logs
        console.debug("[useAnalytics] fetched", {
          range,
          start,
          end,
          preview: body.data.slice(0, 20),
        });
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err);
      } else {
        setError(new Error(String(err)));
      }
    } finally {
      setLoading(false);
    }
  }, [range, start, end]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, meta, loading, error, refetch: fetchData } as const;
}
