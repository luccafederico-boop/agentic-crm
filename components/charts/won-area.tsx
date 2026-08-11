"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/format";

export type WonPoint = {
  month: string; // "2026-03"
  label: string; // "Mar"
  total: number;
  count: number;
};

export function WonArea({ data }: { data: WonPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
          tickFormatter={(v: number) =>
            v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`
          }
        />
        <Tooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as WonPoint;
            return (
              <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm">
                <p className="font-medium">{p.label}</p>
                <p className="text-muted-foreground">
                  {formatMoney(p.total, "USD")} · {p.count} won
                </p>
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="var(--chart-2)"
          strokeWidth={2}
          fill="var(--chart-2)"
          fillOpacity={0.15}
          dot={{ r: 3, fill: "var(--chart-2)" }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
