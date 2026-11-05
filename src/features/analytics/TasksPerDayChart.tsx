"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useChartPalette } from "./chart-palette";
import type { DayCount } from "./metrics";

export function TasksPerDayChart({ data }: { data: DayCount[] }) {
  const palette = useChartPalette();

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Tasks per day</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
          <XAxis
            dataKey="date"
            stroke={palette.axis}
            fontSize={11}
            tickFormatter={(d: string) => d.slice(5)}
          />
          <YAxis stroke={palette.axis} fontSize={11} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: palette.tooltipBg,
              border: `1px solid ${palette.tooltipBorder}`,
              borderRadius: 12,
              color: palette.tooltipText,
            }}
          />
          <Legend />
          <Bar dataKey="created" name="Created" fill={palette.series} radius={[4, 4, 0, 0]} />
          <Bar
            dataKey="completed"
            name="Completed"
            fill={palette.seriesAlt}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
