"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { CycleTimePoint } from "./metrics";

export function CycleTimeChart({ data }: { data: CycleTimePoint[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Cycle time (hours)</h3>
      {data.length === 0 ? (
        <p className="text-sm text-text-muted">No completed tasks yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" />
            <XAxis
              dataKey="label"
              stroke="#94A3B8"
              fontSize={10}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={60}
            />
            <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "#17171F",
                border: "1px solid #1E1E2E",
                borderRadius: 12,
              }}
            />
            <Bar dataKey="hours" name="Hours" fill="#0D9488" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
