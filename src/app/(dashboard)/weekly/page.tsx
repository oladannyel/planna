import { getTasksInRange } from "@/features/tasks/queries";
import { WeeklyPlanner } from "@/features/weekly";
import { bucketByDay, resolveWeekStart, shiftWeek, weekDays } from "@/features/weekly/week";

export default async function WeeklyPage({
  searchParams,
}: {
  searchParams: { week?: string | string[] };
}) {
  const weekParam = typeof searchParams.week === "string" ? searchParams.week : undefined;
  const weekStart = resolveWeekStart(weekParam, new Date());
  const days = weekDays(weekStart);
  const start = days[0]?.date ?? weekStart;
  const end = days[days.length - 1]?.date ?? weekStart;

  const result = await getTasksInRange(start, end);
  const tasks = result.ok ? result.value : [];
  const buckets = bucketByDay(tasks, days);

  return (
    <WeeklyPlanner
      days={days}
      buckets={buckets}
      prevWeek={shiftWeek(weekStart, -1)}
      nextWeek={shiftWeek(weekStart, 1)}
    />
  );
}
