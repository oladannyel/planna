"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useChartPalette } from "./chart-palette";
import type { TagCount } from "./metrics";

export function CategoryBreakdown({ data }: { data: TagCount[] }) {
  const palette = useChartPalette();

  return (
    <div className="surface p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Top categories</h3>
      {data.length === 0 ? (
        <p className="text-sm text-text-muted">No tagged tasks yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} horizontal={false} />
            <XAxis type="number" stroke={palette.axis} fontSize={11} allowDecimals={false} />
            <YAxis type="category" dataKey="tag" stroke={palette.axis} fontSize={11} width={80} />
            <Tooltip
              contentStyle={{
                background: palette.tooltipBg,
                border: `1px solid ${palette.tooltipBorder}`,
                borderRadius: 12,
                color: palette.tooltipText,
              }}
            />
            <Bar dataKey="count" name="Tasks" fill={palette.series} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
