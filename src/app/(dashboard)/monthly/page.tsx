import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { bestStreak, monthlyStats } from "@/features/analytics/metrics";
import {
  MonthlyCalendar,
  MonthlyStats,
  MonthlySummary,
  dayDots,
  getMonthlySummary,
  monthGrid,
  monthLabel,
  monthParam,
  resolveMonth,
  shiftMonth,
} from "@/features/monthly";
import { getTasks } from "@/features/tasks/queries";

export default async function MonthlyPage({
  searchParams,
}: {
  searchParams: { month?: string | string[] };
}) {
  const param = typeof searchParams.month === "string" ? searchParams.month : undefined;
  const ref = resolveMonth(param, new Date());

  const result = await getTasks();
  const all = result.ok ? result.value : [];
  const created = all.filter((task) => task.createdAt.slice(0, 7) === monthParam(ref));

  const stats = monthlyStats(created);
  const best = bestStreak(created);
  const weeks = monthGrid(ref);
  const dots = dayDots(all, new Date());

  const summaryResult = await getMonthlySummary(ref.year, ref.month);
  const initialNarrative =
    summaryResult.ok && summaryResult.value ? summaryResult.value.narrative : null;

  const navLink =
    "rounded-lg border border-border p-1.5 text-text-secondary hover:text-text-primary";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Monthly</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/monthly?month=${monthParam(shiftMonth(ref, -1))}`}
            aria-label="Previous month"
            className={navLink}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <span className="text-sm text-text-secondary">{monthLabel(ref)}</span>
          <Link
            href={`/monthly?month=${monthParam(shiftMonth(ref, 1))}`}
            aria-label="Next month"
            className={navLink}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      <MonthlyStats stats={stats} bestStreak={best} />
      <MonthlySummary
        year={ref.year}
        month={ref.month}
        hasTasks={created.length > 0}
        initialNarrative={initialNarrative}
      />
      <MonthlyCalendar weeks={weeks} dots={dots} tasks={all} />
    </div>
  );
}
