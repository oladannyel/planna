import { subDays } from "date-fns";
import { BarChart3 } from "lucide-react";

import { EmptyState } from "@/components/shared";
import {
  CategoryBreakdown,
  CycleTimeChart,
  TasksPerDayChart,
} from "@/features/analytics/LazyCharts";
// Import metrics + the static card from their direct modules (not the feature
// barrel) so the barrel's static chart re-exports don't pull Recharts into the
// route's initial bundle.
import { OnTimeRateCard } from "@/features/analytics/OnTimeRateCard";
import {
  carryoverRate,
  categoryBreakdown,
  completionRate,
  cycleTimes,
  onTimeRate,
  scheduledRate,
  tasksPerDay,
} from "@/features/analytics/metrics";
import { getTasks } from "@/features/tasks/queries";
import { toISODate } from "@/lib/date";

export default async function AnalyticsPage() {
  const result = await getTasks();
  const tasks = result.ok ? result.value : [];

  if (tasks.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <EmptyState
          icon={BarChart3}
          title="No data yet"
          message="Create and complete some tasks to see your throughput, cycle time, and categories."
        />
      </div>
    );
  }

  const today = new Date();
  const days = Array.from({ length: 14 }, (_, index) => toISODate(subDays(today, 13 - index)));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <OnTimeRateCard
        onTimeRate={onTimeRate(tasks)}
        scheduledRate={scheduledRate(tasks)}
        completionRate={completionRate(tasks)}
        carryoverRate={carryoverRate(tasks)}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TasksPerDayChart data={tasksPerDay(tasks, days)} />
        <CycleTimeChart data={cycleTimes(tasks)} />
        <CategoryBreakdown data={categoryBreakdown(tasks).slice(0, 8)} />
      </div>
    </div>
  );
}
