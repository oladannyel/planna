import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import type { Task } from "@/features/tasks/types";
import { toISODate } from "@/lib/date";

export interface MonthRef {
  year: number;
  month: number; // 1–12
}

export interface CalendarDay {
  date: string; // ISO "YYYY-MM-DD"
  day: number;
  inMonth: boolean;
}

export type DayDot = "done" | "in_progress" | "overdue";

const MONTH_PARAM_RE = /^\d{4}-\d{2}$/;

/** Resolve a `?month=YYYY-MM` param to a month, falling back to the current month. */
export function resolveMonth(param: string | undefined, today: Date): MonthRef {
  if (param && MONTH_PARAM_RE.test(param)) {
    const [yearStr = "", monthStr = ""] = param.split("-");
    return { year: Number(yearStr), month: Number(monthStr) };
  }
  return { year: today.getFullYear(), month: today.getMonth() + 1 };
}

/** `"YYYY-MM"` param for a month (for deep-links). */
export function monthParam(ref: MonthRef): string {
  return `${ref.year}-${String(ref.month).padStart(2, "0")}`;
}

/** `"June 2026"` display label. */
export function monthLabel(ref: MonthRef): string {
  return format(new Date(ref.year, ref.month - 1, 1), "MMMM yyyy");
}

/** Move `delta` months (handles year boundaries). */
export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const moved = addMonths(new Date(ref.year, ref.month - 1, 1), delta);
  return { year: moved.getFullYear(), month: moved.getMonth() + 1 };
}

/** A full month grid (Mon→Sun weeks) including leading/trailing days. */
export function monthGrid(ref: MonthRef): CalendarDay[][] {
  const first = new Date(ref.year, ref.month - 1, 1);
  const gridStart = startOfWeek(startOfMonth(first), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(first), { weekStartsOn: 1 });

  const days: CalendarDay[] = eachDayOfInterval({ start: gridStart, end: gridEnd }).map((d) => ({
    date: toISODate(d),
    day: d.getDate(),
    inMonth: d.getMonth() === ref.month - 1,
  }));

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

/**
 * Status dots per calendar date (§9): green=done, amber=in_progress, red=overdue.
 * Plain upcoming todos get no dot; cancelled tasks are ignored.
 */
export function dayDots(tasks: Task[], today: Date): Record<string, DayDot[]> {
  const map: Record<string, DayDot[]> = {};
  const todayIso = toISODate(today);
  const push = (date: string, dot: DayDot): void => {
    (map[date] ??= []).push(dot);
  };

  for (const task of tasks) {
    if (task.status === "cancelled") continue;

    if (task.status === "done") {
      const date = task.completedAt !== null ? task.completedAt.slice(0, 10) : task.dueDate;
      if (date !== null) push(date, "done");
      continue;
    }

    if (task.dueDate === null) continue;
    if (task.dueDate < todayIso) {
      push(task.dueDate, "overdue");
    } else if (task.status === "in_progress") {
      push(task.dueDate, "in_progress");
    }
  }

  return map;
}
