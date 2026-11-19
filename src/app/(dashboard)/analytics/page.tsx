import { subDays } from "date-fns";
import { BarChart3 } from "lucide-react";

import { PageHeader } from "@/components/layout";
import { EmptyState } from "@/components/shared";
import { CategoryBreakdown } from "@/features/analytics/CategoryBreakdown";
import { CycleTimeChart, TasksPerDayChart } from "@/features/analytics/LazyCharts";
// Import metrics and the static panels from their direct modules (not the
// feature barrel) so the barrel's chart re-exports don't pull Recharts into
// the route's initial bundle.
import { MetricCards } from "@/features/analytics/MetricCards";
import { OnTimeRateCard } from "@/features/analytics/OnTimeRateCard";
import {
  avgCycleTimeHours,
  carryoverRate,
  categoryBreakdown,
  completionRate,
  cycleTimes,
  onTimeRate,
  openTaskCount,
  periodComparison,
  scheduledRate,
  tasksPerDay,
} from "@/features/analytics/metrics";
import { getTasks } from "@/features/tasks/queries";
import { toISODate } from "@/lib/date";

const TREND_DAYS = 7;
const CHART_DAYS = 14;

export default async function AnalyticsPage() {
  const result = await getTasks();
  const tasks = result.ok ? result.value : [];

  if (tasks.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Analytics"
          crumbs={[{ label: "Home", href: "/" }, { label: "Analytics" }]}
        />
        <EmptyState
          icon={BarChart3}
          title="No data yet"
          message="Create and complete some tasks to see your throughput, cycle time, and categories."
        />
      </div>
    );
  }

  const today = new Date();
  const days = Array.from({ length: CHART_DAYS }, (_, index) =>
    toISODate(subDays(today, CHART_DAYS - 1 - index)),
  );
  const trend = periodComparison(tasks, TREND_DAYS, today);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        crumbs={[{ label: "Home", href: "/" }, { label: "Analytics" }]}
      />

      {/* Headline first, detail under it: the row of tiles answers "how is it
          going" in one look, and everything below says why. */}
      <MetricCards
        created={trend.created}
        completed={trend.completed}
        avgCycleTimeHours={avgCycleTimeHours(tasks)}
        openTasks={openTaskCount(tasks)}
        days={TREND_DAYS}
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TasksPerDayChart data={tasksPerDay(tasks, days)} />
        </div>
        <OnTimeRateCard
          onTimeRate={onTimeRate(tasks)}
          scheduledRate={scheduledRate(tasks)}
          completionRate={completionRate(tasks)}
          carryoverRate={carryoverRate(tasks)}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CycleTimeChart data={cycleTimes(tasks)} />
        </div>
        <CategoryBreakdown data={categoryBreakdown(tasks).slice(0, 8)} />
      </div>
    </div>
  );
}
