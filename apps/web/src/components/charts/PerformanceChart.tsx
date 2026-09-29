"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PerformancePoint } from "@val-sistem/shared";
import { formatCurrency } from "@val-sistem/shared";
import { SEQUENTIAL_BLUE, useChartTheme } from "@/lib/chart-colors";

const PERIODS = [
  { key: "1W", days: 7 },
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "6M", days: 180 },
  { key: "1Y", days: 365 },
  { key: "ALL", days: Infinity },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

// Rendimiento histórico del portafolio (RFW-04): serie única en el tiempo
// -> area chart, un solo hue (choosing-a-form.md). Selector de periodo
// (1W…ALL) igual al de la referencia visual del proyecto. Sin legenda (una
// sola serie no la necesita: el título de la Card ya la nombra). Un solo
// eje — nunca dual-axis.
export function PerformanceChart({
  data,
  currency = "USD",
}: {
  data: PerformancePoint[];
  currency?: string;
}) {
  const [period, setPeriod] = useState<PeriodKey>("1M");
  const { gridHairline, axisBaseline, textMuted } = useChartTheme();

  const visible = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period)?.days ?? data.length;
    return Number.isFinite(days) ? data.slice(-days) : data;
  }, [data, period]);

  return (
    <div>
      <div className="mb-3 flex justify-end gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              period === p.key
                ? "bg-primary text-white"
                : "text-text-muted hover:bg-surface-raised hover:text-foreground"
            }`}
          >
            {p.key}
          </button>
        ))}
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visible} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="performanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SEQUENTIAL_BLUE} stopOpacity={0.35} />
                <stop offset="100%" stopColor={SEQUENTIAL_BLUE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridHairline} vertical={false} />
            <XAxis
              dataKey="date"
              stroke={axisBaseline}
              tick={{ fill: textMuted, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: axisBaseline }}
              minTickGap={32}
            />
            <YAxis
              stroke={axisBaseline}
              tick={{ fill: textMuted, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={72}
              tickFormatter={(v: number) => formatCurrency(v, currency)}
            />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value), currency)}
              contentStyle={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border-hairline)",
                borderRadius: 8,
                fontSize: 13,
              }}
              labelStyle={{ color: "var(--text-secondary)" }}
            />
            <Area
              type="monotone"
              dataKey="totalValue"
              stroke={SEQUENTIAL_BLUE}
              strokeWidth={2}
              fill="url(#performanceFill)"
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
