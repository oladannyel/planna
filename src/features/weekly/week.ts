import { addDays, addWeeks, format, parseISO, startOfWeek } from "date-fns";

import type { Task } from "@/features/tasks/types";
import { toISODate } from "@/lib/date";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface WeekDay {
  date: string; // ISO "YYYY-MM-DD"
  weekday: string; // "Mon"
  label: string; // "Jun 16"
}

/** Monday-anchored start (ISO date) of the week containing `date`. */
export function getWeekStart(date: Date): string {
  return toISODate(startOfWeek(date, { weekStartsOn: 1 }));
}

/** Resolve the `?week=` param to a Monday start, falling back to this week. */
export function resolveWeekStart(weekParam: string | undefined, today: Date): string {
  if (weekParam && ISO_DATE_RE.test(weekParam)) {
    return getWeekStart(parseISO(weekParam));
  }
  return getWeekStart(today);
}

/** The seven days (Mon→Sun) of the week starting at `weekStart`. */
export function weekDays(weekStart: string): WeekDay[] {
  const start = parseISO(weekStart);
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(start, index);
    return {
      date: toISODate(day),
      weekday: format(day, "EEE"),
      label: format(day, "MMM d"),
    };
  });
}

/** Shift a week start by `delta` weeks (negative = earlier). */
export function shiftWeek(weekStart: string, delta: number): string {
  return toISODate(addWeeks(parseISO(weekStart), delta));
}

/** Group tasks into per-day buckets keyed by each day's ISO date. */
export function bucketByDay(tasks: Task[], days: WeekDay[]): Record<string, Task[]> {
  const buckets: Record<string, Task[]> = {};
  for (const day of days) {
    buckets[day.date] = [];
  }
  for (const task of tasks) {
    if (task.dueDate === null) continue;
    const bucket = buckets[task.dueDate];
    if (bucket) bucket.push(task);
  }
  return buckets;
}
