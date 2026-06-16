import type { DragEndEvent } from "@dnd-kit/core";

import { updateTaskStatus } from "@/features/tasks/actions";
import { isTaskStatus } from "@/features/tasks/status";
import type { Task, TaskStatus } from "@/features/tasks/types";

export interface Drop {
  taskId: string;
  status: TaskStatus;
}

/** Interpret a dnd-kit drag-end event as a task→column move, or `null`. */
export function resolveDrop(event: DragEndEvent): Drop | null {
  const { active, over } = event;
  if (!over) return null;
  const status = String(over.id);
  if (!isTaskStatus(status)) return null;
  return { taskId: String(active.id), status };
}

/** Pure optimistic transition: return a new array with the task's status changed. */
export function moveTask(tasks: Task[], taskId: string, status: TaskStatus): Task[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, status } : task));
}

/**
 * Commit a drag: optimistically update local state, persist via the server
 * action, and roll back if it fails. No-op when the drop is invalid or the
 * status is unchanged.
 */
export async function commitDrop(
  event: DragEndEvent,
  tasks: Task[],
  setTasks: (next: Task[]) => void,
): Promise<void> {
  const drop = resolveDrop(event);
  if (!drop) return;

  const task = tasks.find((t) => t.id === drop.taskId);
  if (!task || task.status === drop.status) return;

  setTasks(moveTask(tasks, drop.taskId, drop.status));

  const result = await updateTaskStatus(drop.taskId, drop.status);
  if (!result.ok) {
    setTasks(tasks); // roll back to the pre-drag snapshot
  }
}
