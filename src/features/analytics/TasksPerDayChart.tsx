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

import type { DayCount } from "./metrics";

export function TasksPerDayChart({ data }: { data: DayCount[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Tasks per day</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" />
          <XAxis
            dataKey="date"
            stroke="#94A3B8"
            fontSize={11}
            tickFormatter={(d: string) => d.slice(5)}
          />
          <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "#17171F", border: "1px solid #1E1E2E", borderRadius: 12 }}
          />
          <Legend />
          <Bar dataKey="created" name="Created" fill="#7C3AED" radius={[4, 4, 0, 0]} />
          <Bar dataKey="completed" name="Completed" fill="#0D9488" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
