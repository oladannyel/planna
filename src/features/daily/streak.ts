import { parseISO, subDays } from "date-fns";

import type { Task } from "@/features/tasks/types";
import { toISODate } from "@/lib/date";

/** ISO dates ("YYYY-MM-DD") on which at least one task was completed. */
export function completedDates(tasks: Task[]): string[] {
  return tasks
    .filter((task) => task.status === "done")
    .map((task) => task.completedAt)
    .filter((value): value is string => value !== null)
    .map((iso) => toISODate(parseISO(iso)));
}

/**
 * Current streak: consecutive days with ≥ 1 completion, counting back from
 * `today` (inclusive). Returns 0 if nothing was completed today.
 */
export function computeCurrentStreak(dates: Iterable<string>, today: Date): number {
  const set = new Set(dates);
  let streak = 0;
  let cursor = today;
  while (set.has(toISODate(cursor))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }
  return streak;
}
