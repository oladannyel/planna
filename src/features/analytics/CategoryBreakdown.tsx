"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { TagCount } from "./metrics";

export function CategoryBreakdown({ data }: { data: TagCount[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Top categories</h3>
      {data.length === 0 ? (
        <p className="text-sm text-text-muted">No tagged tasks yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" horizontal={false} />
            <XAxis type="number" stroke="#94A3B8" fontSize={11} allowDecimals={false} />
            <YAxis type="category" dataKey="tag" stroke="#94A3B8" fontSize={11} width={80} />
            <Tooltip
              contentStyle={{
                background: "#17171F",
                border: "1px solid #1E1E2E",
                borderRadius: 12,
              }}
            />
            <Bar dataKey="count" name="Tasks" fill="#7C3AED" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
