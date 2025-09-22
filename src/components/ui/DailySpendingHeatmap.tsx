'use client';

import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { use as registerECharts } from 'echarts/core';
import type { EChartsOption } from 'echarts/types/dist/echarts';
import { HeatmapChart } from 'echarts/charts';
import { TooltipComponent, VisualMapComponent, CalendarComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Register only the components we need for calendar heatmap
registerECharts([
  HeatmapChart,
  TooltipComponent,
  VisualMapComponent,
  CalendarComponent,
  CanvasRenderer,
]);

/**
 * Reusable calendar heatmap (ECharts calendar coordinate).
 * Data contract prefers pre-aggregated daily series; still supports legacy transactions input.
 *
 * props.data: Array<[yyyy-mm-dd, value]> (preferred)
 * props.transactions: { date: ISOString|yyyy-mm-dd, amount: number }[] (legacy)
 * props.yearOrRange: '2025' | '2024-01-01:2025-12-31' | 'last12' (default)
 * props.mode: 'absolute' | 'percentile' | 'log'
 */
export default function SpendingCalendarHeatmap({
  data,
  transactions,
  yearOrRange = 'last12',
  mode = 'percentile',
  height = 240,
}: {
  data?: [string, number][];
  transactions?: { date: string; amount: number }[];
  yearOrRange?: string | [string, string];
  mode?: 'absolute' | 'percentile' | 'log';
  height?: number;
}) {
  // Resolve theme tokens from CSS variables for consistent palette
  const css =
    typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement)
      : ({} as CSSStyleDeclaration);
  const safeColor = (v: string | null | undefined, fallback: string) => {
    const s = (v || '').trim();
    if (!s || s.includes('oklch')) {
      return fallback;
    }
    return s;
  };
  // Convert any CSS color (including oklch(...)) to a canvas-friendly rgb(a) string
  const toRenderableColor = (colorStr: string | null | undefined, fallback: string) => {
    try {
      const s = (colorStr || '').trim();
      if (!s) {
        return fallback;
      }
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return fallback;
      }
      const el = document.createElement('span');
      el.style.color = s;
      document.body.appendChild(el);
      const computed = getComputedStyle(el).color;
      document.body.removeChild(el);
      if (computed && computed !== '') {
        return computed;
      }
      // If computed was not helpful, allow hex or rgb literals through
      if (s.startsWith('#') || s.startsWith('rgb')) {
        return s;
      }
      return fallback;
    } catch {
      return fallback;
    }
  };
  const parseColor = (str: string): { r: number; g: number; b: number } | null => {
    const s = str.trim();
    // rgb/rgba
    const m = /rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s);
    if (m) {
      return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
    }
    // hex #rrggbb or #rgb
    if (s.startsWith('#')) {
      const hex = s.replace('#', '');
      if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return { r, g, b };
      }
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return { r, g, b };
      }
    }
    return null;
  };
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, '0');
  };
  const colorFg = safeColor(css.getPropertyValue('--muted-foreground'), '#a3a3a3');
  const colorMid = safeColor(css.getPropertyValue('--primary-foreground'), '#94a3b8');
  const colorHigh = safeColor(css.getPropertyValue('--primary'), '#6366f1');
  // Light/dark aware grid border
  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const gridBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';
  // Brand color from theme (oklch) converted to hex via CSS computed style
  const colorToHex = (str: string, fallbackHex: string) => {
    const p = parseColor(str) || parseColor(fallbackHex);
    if (!p) {
      return fallbackHex;
    }
    return `#${toHex(p.r)}${toHex(p.g)}${toHex(p.b)}`;
  };
  const brandRGB = toRenderableColor(
    css.getPropertyValue('--ring') || 'oklch(0.4814 0.2784 286.5420)',
    '#FF0000',
  );
  const brandHex = colorToHex(brandRGB, '#FF0000');
  // Build smooth white -> brand gradient for percentile mapping
  const gradientBrand: string[] = (() => {
    const white = '#10BA00';
    const steps = 21; // fine-grained
    const out: string[] = [];
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1); // 0..1
      // mix white->brand in hex space
      const a = parseColor(white)!;
      const b = parseColor(brandHex)!;
      const r = a.r + (b.r - a.r) * t;
      const g = a.g + (b.g - a.g) * t;
      const bl = a.b + (b.b - a.b) * t;
      out.push(`#${toHex(r)}${toHex(g)}${toHex(bl)}`);
    }
    return out;
  })();

  // Aggregate amounts by day (yyyy-MM-dd)
  const daily = useMemo(() => {
    if (data?.length) {
      return data;
    }
    const map = new Map<string, number>();
    for (const tx of transactions ?? []) {
      const d = tx.date.split('T')[0];
      map.set(d, (map.get(d) ?? 0) + tx.amount);
    }
    return Array.from(map.entries()).map(([d, amount]) => [d, amount] as [string, number]);
  }, [data, transactions]);

  // Decide date range to show. Default: last 12 months
  const rangeParam = useMemo((): string | [string, string] => {
    // Default: last 12 months as [start, end]
    if (!yearOrRange || (typeof yearOrRange === 'string' && yearOrRange === 'last12')) {
      const end = new Date();
      const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1));
      const startStr = start.toISOString().slice(0, 10);
      const endStr = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0))
        .toISOString()
        .slice(0, 10);
      return [startStr, endStr];
    }
    // If tuple already
    if (Array.isArray(yearOrRange)) {
      return yearOrRange;
    }
    // If colon-delimited, parse to [start, end]
    if (yearOrRange.includes(':')) {
      const [a, b] = yearOrRange.split(':');
      if (a && b) {
        return [a, b];
      }
    }
    // If numeric year, let ECharts resolve the calendar year
    if (/^\d{4}$/.test(yearOrRange)) {
      return yearOrRange;
    }
    // Fallback to last12 array
    const end = new Date();
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1));
    return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
  }, [yearOrRange]);

  // Build values array for scaling
  const amounts = useMemo(() => daily.map(([, a]) => a), [daily]);

  // Percentile helper
  function percentileRanks(values: number[]) {
    if (!values.length) {
      return new Map<number, number>();
    }
    const arr = [...values].sort((a, b) => a - b);
    const map = new Map<number, number>();
    for (const v of values) {
      // rank is percentage of values <= v
      const idx = arr.lastIndexOf(v);
      map.set(v, Math.round(((idx + 1) / arr.length) * 100));
    }
    return map;
  }

  const percentMap = useMemo(() => percentileRanks(amounts), [amounts]);

  // User focus filter: all | top 10% | bottom 10%
  const [focus, setFocus] = useState<'all' | 'top' | 'bottom'>('all');

  const processedData = useMemo(() => {
    // We return tuples [date, processedValue, originalAmount] so tooltips can always show the amount
    if (mode === 'percentile') {
      return daily.map(([d, a]) => [d, percentMap.get(a) ?? 0, a] as [string, number, number]);
    }
    if (mode === 'log') {
      return daily.map(([d, a]) => [d, a > 0 ? Math.log10(a) : 0, a] as [string, number, number]);
    }
    // absolute: processed equals original
    return daily.map(([d, a]) => [d, a, a] as [string, number, number]);
  }, [daily, mode, percentMap]);

  // Compute quantile thresholds when not in percentile mode
  const quantile = (vals: number[], q: number) => {
    if (!vals.length) {
      return 0;
    }
    const a = [...vals].sort((x, y) => x - y);
    const pos = (a.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (a[base + 1] !== undefined) {
      return a[base] + rest * (a[base + 1] - a[base]);
    }
    return a[base];
  };
  const p10Abs = useMemo(() => quantile(amounts, 0.1), [amounts]);
  const p90Abs = useMemo(() => quantile(amounts, 0.9), [amounts]);

  // Apply focus highlight via per-item opacity
  const seriesData = useMemo(() => {
    // Base as objects so we can apply itemStyle uniformly
    const base = processedData.map(([d, v, orig]) => ({ value: [d, v, orig] }));
    if (focus === 'all') {
      return base;
    }
    if (mode === 'percentile') {
      return base.map((it) => ({
        ...it,
        itemStyle: {
          opacity:
            focus === 'top'
              ? (it.value as number[])[1] >= 90
                ? 1
                : 0.25
              : (it.value as number[])[1] <= 10
              ? 1
              : 0.25,
        },
      }));
    }
    // absolute/log: use amounts quantiles against original amount (index 2)
    return base.map((it) => ({
      ...it,
      itemStyle: {
        opacity:
          focus === 'top'
            ? (it.value as number[])[2] >= p90Abs
              ? 1
              : 0.25
            : (it.value as number[])[2] <= p10Abs
            ? 1
            : 0.25,
      },
    }));
  }, [processedData, focus, mode, p10Abs, p90Abs]);

  // visualMap min/max depending on mode
  const visualMin =
    mode === 'percentile'
      ? 0
      : Math.min(
          ...processedData.map(([, v]) => v).filter((n) => n !== null && !Number.isNaN(n)),
          0,
        );
  const visualMax = mode === 'percentile' ? 100 : Math.max(...processedData.map(([, v]) => v), 1);

  const currencyFmt = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
    [],
  );

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    textStyle: { color: colorFg },
    tooltip: {
      position: 'top',
      formatter: (params: any): string => {
        const dateStr: string = params.value?.[0] ?? params.name;
        const original = Number(params.value?.[2] ?? 0);
        const dt = new Date(dateStr + 'T00:00:00Z');
        const dateLabel = new Intl.DateTimeFormat(undefined, {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(dt);
        return `${dateLabel}<br/>${currencyFmt.format(original)}`;
      },
    },
    visualMap:
      mode === 'percentile'
        ? {
            min: 0,
            max: 100,
            show: true,
            orient: 'horizontal',
            left: 'center',
            bottom: 8,
            text: ['Higher', 'Lower'],
            textStyle: { color: colorFg },
            dimension: 1,
            inRange: { color: gradientBrand },
            calculable: true,
          }
        : {
            min: visualMin,
            max: visualMax,
            show: true,
            orient: 'horizontal',
            left: 'center',
            bottom: 8,
            text: ['Higher', 'Lower'],
            textStyle: { color: colorFg },
            dimension: 1,
            inRange: { color: ['#e5e7eb', colorMid, colorHigh] },
            calculable: true,
          },
    calendar: {
      range: rangeParam,
      cellSize: ['auto', 13],
      top: 70,
      left: 20,
      right: 20,
      itemStyle: { borderWidth: 0.5, borderColor: gridBorder },
      splitLine: { show: false, lineStyle: { color: gridBorder, width: 0.5 } },
      yearLabel: { show: false },
      dayLabel: { color: colorFg },
      monthLabel: { color: colorFg },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: seriesData,
        // We use the 2nd value (index 1) for visual mapping, and carry original at index 2
        encode: { value: 1 },
        emphasis: {
          itemStyle: { borderColor: colorHigh, borderWidth: 1 },
        },
        progressive: 400,
        animation: true,
        animationDuration: 300,
        animationEasing: 'cubicOut',
        animationDurationUpdate: 250,
      },
    ],
  };

  return (
    <div className="flex flex-col gap-2">
      <ReactECharts option={option} style={{ height, width: '100%' }} />
      {/* Footer controls: focus toggles only */}
      <div className="flex items-center justify-end px-2 pb-1">
        <div className="flex items-center gap-1">
          {(
            [
              { k: 'all', label: 'All' },
              { k: 'top', label: 'Top 10%' },
              { k: 'bottom', label: 'Bottom 10%' },
            ] as const
          ).map(({ k, label }) => (
            <button
              key={k}
              type="button"
              onClick={() => setFocus(k)}
              aria-pressed={focus === k}
              className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                focus === k
                  ? 'bg-[rgba(0,0,0,0.06)] dark:bg-[rgba(255,255,255,0.08)]'
                  : 'bg-transparent'
              }`}
              style={{
                color: colorFg,
                borderColor: gridBorder,
                borderWidth: 1,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
