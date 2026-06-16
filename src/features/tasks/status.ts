import type { TaskPriority, TaskStatus } from "./types";

export const TASK_STATUSES: readonly TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

export const TASK_PRIORITIES: readonly TaskPriority[] = ["low", "medium", "high", "urgent"];

export function isTaskPriority(value: string): value is TaskPriority {
  return (TASK_PRIORITIES as readonly string[]).includes(value);
}
