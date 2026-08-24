import type { TaskPriority, TaskStatus } from "./types";

export const TASK_STATUSES: readonly TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const TASK_PRIORITIES: readonly TaskPriority[] = ["low", "medium", "high", "urgent"];

export function isTaskPriority(value: string): value is TaskPriority {
  return (TASK_PRIORITIES as readonly string[]).includes(value);
}
