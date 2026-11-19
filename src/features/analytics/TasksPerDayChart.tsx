"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ComponentCard } from "@/components/ui";

import { ChartLegend, tooltipStyles } from "./chart-chrome";
import { useChartPalette } from "./chart-palette";
import type { DayCount } from "./metrics";

/** "2026-11-19" → "19 Nov", which is what a human reads on an axis. */
function tickLabel(iso: string): string {
  const [, month, day] = iso.split("-");
  const name = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    Number(month) - 1
  ];
  return `${Number(day)} ${name ?? ""}`.trim();
}

/**
 * Created against completed, per day.
 *
 * Two series, so the colours carry identity and the legend is not optional.
 * The legend is rendered as real markup rather than Recharts' own, which
 * styles its labels with inline SVG text the theme cannot reach — that is why
 * the old one rendered in a colour nothing in the palette defines.
 */
export function TasksPerDayChart({ data }: { data: DayCount[] }) {
  const palette = useChartPalette();

  return (
    <ComponentCard
      title="Tasks per day"
      description="Created against completed, over the last two weeks."
      contentClassName="px-2 pb-5 sm:px-4"
      action={
        <ChartLegend
          items={[
            { label: "Created", className: "bg-chart-1" },
            { label: "Completed", className: "bg-chart-2" },
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
          {/* Horizontal rules only: vertical ones fence off bars that already
              sit in their own slot, and the grid is context, not content. */}
          <CartesianGrid stroke={palette.grid} vertical={false} />
          <XAxis
            dataKey="date"
            stroke={palette.axis}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={16}
            tickFormatter={tickLabel}
          />
          <YAxis
            stroke={palette.axis}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={28}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: palette.grid, opacity: 0.4 }}
            labelFormatter={(value) => (typeof value === "string" ? tickLabel(value) : value)}
            contentStyle={tooltipStyles(palette)}
          />
          <Bar dataKey="created" name="Created" fill={palette.series} radius={[4, 4, 0, 0]} />
          <Bar
            dataKey="completed"
            name="Completed"
            fill={palette.seriesAlt}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ComponentCard>
  );
}
