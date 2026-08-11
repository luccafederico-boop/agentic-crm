"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatMoneyCompact } from "@/lib/format";

export type PipelinePoint = {
  stage: string;
  label: string;
  total: number;
  count: number;
};

export function PipelineBar({
  data,
  currency,
}: {
  data: PipelinePoint[];
  currency: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid
          vertical={false}
          stroke="var(--border)"
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickFormatter={(v: number) => formatMoneyCompact(v, currency)}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as PipelinePoint;
            return (
              <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm">
                <p className="font-medium">{p.label}</p>
                <p className="text-muted-foreground">
                  {formatMoney(p.total, currency)} · {p.count} deal
                  {p.count === 1 ? "" : "s"}
                </p>
              </div>
            );
          }}
        />
        <Bar
          dataKey="total"
          fill="var(--chart-2)"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
