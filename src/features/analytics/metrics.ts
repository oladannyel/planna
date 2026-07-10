import { differenceInCalendarDays, differenceInHours, parseISO } from "date-fns";

import { completedDates } from "@/features/daily/streak";
import type { Task } from "@/features/tasks/types";

export interface TagCount {
  tag: string;
  count: number;
}

export interface DayCount {
  date: string; // ISO "YYYY-MM-DD"
  created: number;
  completed: number;
}

export interface CycleTimePoint {
  label: string;
  hours: number;
}

export interface InsightStats {
  totalCreated: number;
  totalCompleted: number;
  totalCarried: number;
  completionRate: number; // 0–100
  carryoverRate: number; // 0–100
  avgCycleTimeHours: number;
  onTimeRate: number; // 0–100, among completed tasks that had a deadline
  scheduledRate: number; // 0–100, share of tasks that have a deadline
  topTags: TagCount[];
}

/** Integer percentage, divide-by-zero safe. */
function pct(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);
}

function isDone(task: Task): boolean {
  return task.status === "done";
}

/** The task's deadline as an epoch ms, preferring the precise dueAt over date-only dueDate. */
function deadlineMs(task: Task): number | null {
  if (task.dueAt) return parseISO(task.dueAt).getTime();
  if (task.dueDate) return parseISO(`${task.dueDate}T23:59:59.999Z`).getTime();
  return null;
}

/** Whether a task has any deadline set. */
function hasDeadline(task: Task): boolean {
  return Boolean(task.dueAt) || Boolean(task.dueDate);
}

/** A completed task counts as on-time if it finished by its deadline. */
export function isOnTime(task: Task): boolean {
  if (!isDone(task) || !task.completedAt) return false;
  const deadline = deadlineMs(task);
  if (deadline === null) return false;
  return parseISO(task.completedAt).getTime() <= deadline;
}

export function completionRate(tasks: Task[]): number {
  return pct(tasks.filter(isDone).length, tasks.length);
}

export function carryoverRate(tasks: Task[]): number {
  return pct(tasks.filter((task) => task.carriedOver).length, tasks.length);
}

/**
 * On-time rate among completed tasks *that had a deadline*. Tasks completed with
 * no deadline are excluded from the denominator rather than counted as late, so
 * the figure reflects scheduling discipline instead of the absence of due dates.
 */
export function onTimeRate(tasks: Task[]): number {
  const scheduledCompleted = tasks.filter((task) => isDone(task) && hasDeadline(task));
  return pct(scheduledCompleted.filter(isOnTime).length, scheduledCompleted.length);
}

/** Share of tasks that have a deadline set — surfaces how much work is actually scheduled. */
export function scheduledRate(tasks: Task[]): number {
  return pct(tasks.filter(hasDeadline).length, tasks.length);
}

/** Mean hours from creation to completion across done tasks, 1 decimal. */
export function avgCycleTimeHours(tasks: Task[]): number {
  const durations = tasks
    .filter(
      (task): task is Task & { completedAt: string } => isDone(task) && task.completedAt !== null,
    )
    .map((task) => differenceInHours(parseISO(task.completedAt), parseISO(task.createdAt)));
  if (durations.length === 0) return 0;
  const total = durations.reduce((sum, hours) => sum + hours, 0);
  return Math.round((total / durations.length) * 10) / 10;
}

/** Tag frequencies across all tasks, highest first. */
export function categoryBreakdown(tasks: Task[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    for (const tag of task.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function topTags(tasks: Task[], limit = 5): TagCount[] {
  return categoryBreakdown(tasks).slice(0, limit);
}

/** Created/completed counts per supplied day (caller controls the range). */
export function tasksPerDay(tasks: Task[], days: string[]): DayCount[] {
  const created = new Map<string, number>();
  const completed = new Map<string, number>();
  for (const task of tasks) {
    const createdDay = task.createdAt.slice(0, 10);
    created.set(createdDay, (created.get(createdDay) ?? 0) + 1);
    if (task.status === "done" && task.completedAt !== null) {
      const doneDay = task.completedAt.slice(0, 10);
      completed.set(doneDay, (completed.get(doneDay) ?? 0) + 1);
    }
  }
  return days.map((date) => ({
    date,
    created: created.get(date) ?? 0,
    completed: completed.get(date) ?? 0,
  }));
}

/** Per-task cycle time (hours) for the most recent `limit` completed tasks, chronological. */
export function cycleTimes(tasks: Task[], limit = 10): CycleTimePoint[] {
  return tasks
    .filter(
      (task): task is Task & { completedAt: string } => isDone(task) && task.completedAt !== null,
    )
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))
    .slice(0, limit)
    .reverse()
    .map((task) => ({
      label: task.title.length > 20 ? `${task.title.slice(0, 19)}…` : task.title,
      hours: Math.max(0, differenceInHours(parseISO(task.completedAt), parseISO(task.createdAt))),
    }));
}

/** Longest run of consecutive calendar days with ≥ 1 completion. */
export function bestStreak(tasks: Task[]): number {
  const dates = [...new Set(completedDates(tasks))].sort();
  let best = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const iso of dates) {
    const current = parseISO(iso);
    run = previous !== null && differenceInCalendarDays(current, previous) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = current;
  }
  return best;
}

/** Aggregate stats for a period (the `monthly_summaries.stats` shape). */
export function monthlyStats(tasks: Task[]): InsightStats {
  return {
    totalCreated: tasks.length,
    totalCompleted: tasks.filter(isDone).length,
    totalCarried: tasks.filter((task) => task.carriedOver).length,
    completionRate: completionRate(tasks),
    carryoverRate: carryoverRate(tasks),
    avgCycleTimeHours: avgCycleTimeHours(tasks),
    onTimeRate: onTimeRate(tasks),
    scheduledRate: scheduledRate(tasks),
    topTags: topTags(tasks),
  };
}
