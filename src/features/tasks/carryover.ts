import { isBefore, parseISO, startOfDay, startOfToday } from "date-fns";

import type { Task, TaskPriority } from "./types";

/**
 * Tasks that should be flagged as carried over: still open (todo / in_progress)
 * and created on a day before `today`. `today` is injectable for deterministic
 * tests; it defaults to the start of the current day.
 */
export function detectCarryovers(tasks: Task[], today: Date = startOfToday()): Task[] {
  const boundary = startOfDay(today);
  return tasks.filter((task) => {
    if (task.status === "done" || task.status === "cancelled") return false;
    return isBefore(parseISO(task.createdAt), boundary);
  });
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
