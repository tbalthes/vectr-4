'use client';
import React, { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

import type { FlatCategoryRow } from '@/lib/analytics/toSunburst';

export interface SpendingCategoryDonutChartProps {
  data: FlatCategoryRow[];
  height?: number;
}

// Convert a CSS color (including oklch) to a hex string via computed styles
function cssColorToHex(input: string, fallback = '#6E56CF'): string {
  if (!input) {
    return fallback;
  }
  const el = typeof window !== 'undefined' ? document.createElement('div') : null;
  if (!el) {
    return fallback;
  }
  el.style.color = input;
  document.body.appendChild(el);
  const rgb = getComputedStyle(el).color; // e.g., rgb(110, 86, 207)
  document.body.removeChild(el);
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(rgb);
  if (!m) {
    return fallback;
  }
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export default function SpendingCategoryDonutChart({
  data,
  height = 320,
}: SpendingCategoryDonutChartProps) {
  const chartRef = useRef<ReactECharts>(null);
  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const brandHex = useMemo(
    () =>
      cssColorToHex(
        getComputedStyle(document.documentElement).getPropertyValue('--ring') || '#6E56CF',
      ),
    [],
  );

  const option = useMemo(() => {
    // Aggregate spending by category
    const categoryTotals = new Map<string, number>();
    for (const row of data) {
      const category = row.category || 'Uncategorized';
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + Math.max(0, row.amount));
    }

    // Convert to ECharts data format
    const chartData = Array.from(categoryTotals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // Sort by value descending

    const _total = chartData.reduce((sum, item) => sum + item.value, 0);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderColor: isDark ? '#374151' : '#E5E7EB',
        borderWidth: 1,
        textStyle: {
          color: isDark ? '#F9FAFB' : '#111827',
          fontSize: 11,
        },
        padding: [4, 8],
        formatter: (params: { name?: string; value?: number; percent?: number }) => {
          const name = params?.name || '';
          const value = Number(params?.value || 0);
          const percent = Number(params?.percent || 0);
          const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
          return `${name}<br/><b>${fmt.format(value)}</b> (${percent.toFixed(1)}%)`;
        },
      },
      legend: {
        show: false,
      },
      series: [
        {
          name: 'Spending by Category',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          selectedMode: 'single',
          selectedOffset: 10,
          itemStyle: {
            borderRadius: 10,
            borderColor: isDark ? '#374151' : '#FFFFFF',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold',
              color: isDark ? '#E5E7EB' : '#111827',
            },
            itemStyle: {
              borderWidth: 3,
              borderColor: isDark ? '#FFFFFF' : '#000000',
            },
          },
          labelLine: {
            show: false,
          },
          select: {
            label: {
              show: true,
              fontSize: 18,
              fontWeight: 'bold',
              color: isDark ? '#E5E7EB' : '#111827',
              position: 'center',
            },
            itemStyle: {
              borderWidth: 3,
              borderColor: isDark ? '#FFFFFF' : '#000000',
            },
          },
          data: chartData,
          // Enhanced color palette
          color: [
            brandHex,
            '#22C55E',
            '#F59E0B',
            '#EF4444',
            '#06B6D4',
            '#8B5CF6',
            '#10B981',
            '#F97316',
            '#EC4899',
            '#84CC16',
            '#6366F1',
            '#14B8A6',
          ],
        },
      ],
    } as echarts.EChartsOption;
  }, [data, isDark, brandHex]);

  return (
    <div className="w-full flex items-center justify-center" style={{ height }}>
      <ReactECharts
        ref={chartRef}
        echarts={echarts}
        option={option}
        notMerge={true}
        style={{ height: '100%', width: '100%', maxWidth: '450px' }}
      />
    </div>
  );
}
