"use client";

import dynamic from "next/dynamic";

function ChartSkeleton() {
  return <div className="surface h-[320px] w-full animate-pulse" />;
}

// Recharts is heavy; load the chart components in a separate client chunk on
// demand so the analytics route's initial JS stays small. ssr:false is safe —
// the analytics page is dynamic (auth/data) and never statically prerendered.
//
// Only the two charts that genuinely need a plotting library are here. The
// rates and category panels are ranked bars in plain markup: they render on
// the server, cost no JavaScript, and read more exactly than a chart would.
export const TasksPerDayChart = dynamic(
  () => import("./TasksPerDayChart").then((m) => ({ default: m.TasksPerDayChart })),
  { ssr: false, loading: ChartSkeleton },
);

export const CycleTimeChart = dynamic(
  () => import("./CycleTimeChart").then((m) => ({ default: m.CycleTimeChart })),
  { ssr: false, loading: ChartSkeleton },
);
