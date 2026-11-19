"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ComponentCard } from "@/components/ui";

import { tooltipStyles } from "./chart-chrome";
import { useChartPalette } from "./chart-palette";
import type { CycleTimePoint } from "./metrics";

/**
 * How long recent tasks took, slowest first.
 *
 * Horizontal, because the labels are task titles. Vertically they were
 * rotated twenty degrees and still collided, which is the axis telling you
 * the chart is the wrong way round. Ranked rather than chronological: the
 * question this answers is "what is taking the longest", and a baseline
 * shared by every bar compares more exactly than a time order nobody reads.
 *
 * One hue: a single series measuring magnitude. The title names it, so there
 * is nothing for a legend to disambiguate.
 */
export function CycleTimeChart({ data }: { data: CycleTimePoint[] }) {
  const palette = useChartPalette();
  const ranked = [...data].sort((a, b) => b.hours - a.hours);

  return (
    <ComponentCard
      title="Cycle time"
      description="Hours from creation to completion, slowest first."
      contentClassName="px-2 pb-5 sm:px-4"
    >
      {ranked.length === 0 ? (
        <p className="px-3 text-sm text-text-muted">No completed tasks yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, ranked.length * 34)}>
          <BarChart
            data={ranked}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke={palette.grid} horizontal={false} />
            <XAxis
              type="number"
              stroke={palette.axis}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              unit="h"
            />
            <YAxis
              type="category"
              dataKey="label"
              stroke={palette.axis}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={196}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: palette.grid, opacity: 0.4 }}
              formatter={(value) => [`${String(value)}h`, "Cycle time"]}
              contentStyle={tooltipStyles(palette)}
            />
            <Bar dataKey="hours" name="Hours" fill={palette.series} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ComponentCard>
  );
}
