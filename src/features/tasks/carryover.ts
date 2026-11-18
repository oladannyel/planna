import { differenceInCalendarDays, isBefore, parseISO, startOfDay, startOfToday } from "date-fns";

import type { Task, TaskPriority, TaskStatus } from "./types";

/** Statuses still demanding attention — the only ones age is meaningful for. */
const OPEN_STATUSES: readonly TaskStatus[] = ["todo", "in_progress"];

export function isOpenTask(task: Task): boolean {
  return OPEN_STATUSES.includes(task.status);
}

/**
 * Tasks that should be flagged as carried over: still open (todo / in_progress)
 * and created on a day before `today`. `today` is injectable for deterministic
 * tests; it defaults to the start of the current day.
 */
export function detectCarryovers(tasks: Task[], today: Date = startOfToday()): Task[] {
  const boundary = startOfDay(today);
  return tasks.filter((task) => {
    if (!isOpenTask(task)) return false;
    return isBefore(parseISO(task.createdAt), boundary);
  });
}

/**
 * How a task's creation day relates to `today`. `older` means two or more
 * calendar days back — a task that has survived at least one full day of
 * being deferred.
 */
export type TaskAge = "today" | "yesterday" | "older";

export const TASK_AGES: readonly TaskAge[] = ["today", "yesterday", "older"];

export const TASK_AGE_LABELS: Record<TaskAge, string> = {
  today: "Today",
  yesterday: "Yesterday",
  older: "Older",
};

/** Section headings for the daily view, where the framing is the day's plan. */
export const TASK_AGE_HEADINGS: Record<TaskAge, string> = {
  today: "Created today",
  yesterday: "Carried over from yesterday",
  older: "Carried over from earlier",
};

/**
 * Whole calendar days between a task's creation and `today` — 0 for a task
 * created today, 1 for yesterday. Calendar days, not elapsed hours, so a task
 * added at 23:50 last night reads as one day old rather than ten minutes.
 *
 * Like the rest of plAnna's date handling this resolves "today" against the
 * clock of whatever process calls it: server-rendered pages use the server's
 * day boundary, not the viewer's.
 */
export function daysOld(task: Task, today: Date = startOfToday()): number {
  const created = parseISO(task.createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  return Math.max(0, differenceInCalendarDays(startOfDay(today), startOfDay(created)));
}

export function taskAge(task: Task, today: Date = startOfToday()): TaskAge {
  const days = daysOld(task, today);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return "older";
}

/**
 * Split tasks into the three age buckets, preserving input order within each.
 * Every task lands in exactly one bucket, so bucket counts always sum to the
 * input length.
 */
export function groupByAge(tasks: Task[], today: Date = startOfToday()): Record<TaskAge, Task[]> {
  const groups: Record<TaskAge, Task[]> = { today: [], yesterday: [], older: [] };
  for (const task of tasks) groups[taskAge(task, today)].push(task);
  return groups;
}

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Sort for the daily view: carryovers first, then most-deferred first
 * (`carryCount` desc), then by priority (urgent → low).
 */
export function sortDailyTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.carriedOver !== b.carriedOver) return a.carriedOver ? -1 : 1;
    if (a.carryCount !== b.carryCount) return b.carryCount - a.carryCount;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });
}
