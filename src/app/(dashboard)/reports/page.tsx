import { addDays, parseISO } from "date-fns";

import { MonthlySummary, getMonthlySummary, monthParam, resolveMonth } from "@/features/monthly";
import { WeeklyReport, getWeeklyReport } from "@/features/reports";
import { getTasks } from "@/features/tasks/queries";
import { getWeekStart } from "@/features/weekly";
import { toISODate } from "@/lib/date";

export default async function ReportsPage() {
  const today = new Date();
  const weekStart = getWeekStart(today);
  const weekEnd = toISODate(addDays(parseISO(weekStart), 6));
  const monthRef = resolveMonth(undefined, today);

  const result = await getTasks();
  const all = result.ok ? result.value : [];

  const weekHasTasks = all.some((task) => {
    const created = task.createdAt.slice(0, 10);
    return created >= weekStart && created <= weekEnd;
  });
  const monthHasTasks = all.some((task) => task.createdAt.slice(0, 7) === monthParam(monthRef));

  const weekly = await getWeeklyReport(weekStart);
  const monthly = await getMonthlySummary(monthRef.year, monthRef.month);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-text-secondary">This week</h2>
        <WeeklyReport
          weekStart={weekStart}
          hasTasks={weekHasTasks}
          initialNarrative={weekly.ok && weekly.value ? weekly.value.narrative : null}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-text-secondary">This month</h2>
        <MonthlySummary
          year={monthRef.year}
          month={monthRef.month}
          hasTasks={monthHasTasks}
          initialNarrative={monthly.ok && monthly.value ? monthly.value.narrative : null}
        />
      </section>
    </div>
  );
}
