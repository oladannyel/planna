"use client";

import dynamic from "next/dynamic";

function ChartSkeleton() {
  return <div className="h-[260px] w-full animate-pulse rounded-xl bg-card" />;
}

// Recharts is heavy; load the chart components in a separate client chunk on
// demand so the analytics route's initial JS stays small. ssr:false is safe —
// the analytics page is dynamic (auth/data) and never statically prerendered.
export const TasksPerDayChart = dynamic(
  () => import("./TasksPerDayChart").then((m) => ({ default: m.TasksPerDayChart })),
  { ssr: false, loading: ChartSkeleton },
);

export const CategoryBreakdown = dynamic(
  () => import("./CategoryBreakdown").then((m) => ({ default: m.CategoryBreakdown })),
  { ssr: false, loading: ChartSkeleton },
);

export const CycleTimeChart = dynamic(
  () => import("./CycleTimeChart").then((m) => ({ default: m.CycleTimeChart })),
  { ssr: false, loading: ChartSkeleton },
);
