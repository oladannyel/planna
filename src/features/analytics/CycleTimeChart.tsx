"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useChartPalette } from "./chart-palette";
import type { CycleTimePoint } from "./metrics";

export function CycleTimeChart({ data }: { data: CycleTimePoint[] }) {
  const palette = useChartPalette();

  return (
    <div className="surface p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Cycle time (hours)</h3>
      {data.length === 0 ? (
        <p className="text-sm text-text-muted">No completed tasks yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
            <XAxis
              dataKey="label"
              stroke={palette.axis}
              fontSize={10}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={60}
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
            <Bar dataKey="hours" name="Hours" fill={palette.seriesAlt} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
