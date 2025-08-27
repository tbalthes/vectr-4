"use client";
import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import type { SunburstSeriesOption } from "echarts/charts";

export type SunburstNode = {
  name: string;
  value?: number;
  children?: SunburstNode[];
  itemStyle?: {
    color?: string;
    borderColor?: string;
    borderWidth?: number;
  };
};

export interface CategorySunburstProps {
  data: SunburstNode[];
  height?: number;
}

// Convert a CSS color (including oklch) to a hex string via computed styles
function cssColorToHex(input: string, fallback = "#6E56CF"): string {
  if (!input) return fallback;
  const el = typeof window !== "undefined" ? document.createElement("div") : null;
  if (!el) return fallback;
  el.style.color = input;
  document.body.appendChild(el);
  const rgb = getComputedStyle(el).color; // e.g., rgb(110, 86, 207)
  document.body.removeChild(el);
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return fallback;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export default function CategorySunburst({ data, height = 400 }: CategorySunburstProps) {
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const brandHex = useMemo(
    () => cssColorToHex(getComputedStyle(document.documentElement).getPropertyValue("--ring") || "#6E56CF"),
    []
  );
  const border = isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)";

  const option = useMemo(() => {
    const total = (nodes: SunburstNode[]): number =>
      nodes.reduce((sum, n) => sum + (n.value || 0) + (n.children ? total(n.children) : 0), 0);
    const grandTotal = total(data);

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (params: { name?: string; value?: number }) => {
          const name = params?.name || "";
          const value = Number(params?.value || 0);
          const pct = grandTotal > 0 ? ((value / grandTotal) * 100).toFixed(1) : "0.0";
          const fmt = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });
          return `<div style="padding:4px 6px">${name}<br/><b>${fmt.format(value)}</b> • ${pct}%</div>`;
        },
      },
      series: [
        {
          type: "sunburst",
          data,
          nodeClick: "rootToNode",
          sort: (
            a: { depth: number; getValue: () => number; dataIndex: number },
            b: { depth: number; getValue: () => number; dataIndex: number }
          ) => (a.depth === 1 ? b.getValue() - a.getValue() : a.dataIndex - b.dataIndex),
          label: {
            color: isDark ? "#E5E7EB" : "#111827",
            rotate: "radial",
            overflow: "truncate",
            fontSize: 12,
            formatter: (p: unknown) => {
              const params = p as { name?: string; depth?: number; treePathInfo?: unknown[] };
              const name = params?.name ?? "";
              const depth = Array.isArray(params?.treePathInfo)
                ? (params.treePathInfo as unknown[]).length - 1
                : (params.depth ?? 0);
              // Show labels for all depths since we only have categories now
              return String(name);
            },
          },
          labelLayout: () => ({ hideOverlap: true, moveOverlap: "shiftX" }),
          minAngle: 2, // avoid extremely thin slices
          itemStyle: {
            borderColor: border,
            borderWidth: 1,
          },
          levels: [
            {},
            // Depth 1: Categories - larger radius for better visibility
            {
              r0: 0,
              r: 120,
              label: {
                rotate: "tangential",
                fontSize: 13,
                color: isDark ? "#E5E7EB" : "#111827"
              },
              itemStyle: {
                borderColor: border,
                borderWidth: 2
              },
            },
          ] as SunburstSeriesOption["levels"],
          // Enhanced color palette similar to ECharts examples
          color: [
            brandHex,
            "#22C55E",
            "#F59E0B",
            "#EF4444",
            "#06B6D4",
            "#8B5CF6",
            "#10B981",
            "#F97316",
            "#EC4899",
            "#84CC16",
            "#6366F1",
            "#14B8A6"
          ],
          emphasis: {
            focus: "ancestor",
            itemStyle: {
              borderWidth: 3,
              borderColor: isDark ? "#FFFFFF" : "#000000"
            }
          },
        },
      ],
    } as echarts.EChartsOption;
  }, [data, isDark, brandHex, border]);

  return (
    <div className="w-full flex items-center justify-center" style={{ height }}>
      <ReactECharts
        echarts={echarts}
        option={option}
        notMerge={true}
        style={{ height: "100%", width: "100%", maxWidth: "500px" }}
      />
    </div>
  );
}
