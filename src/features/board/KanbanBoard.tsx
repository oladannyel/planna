"use client";

import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";

import { TASK_STATUS_LABELS } from "@/features/tasks/status";
import type { Task, TaskStatus } from "@/features/tasks/types";
import { useTasks } from "@/hooks/useTasks";

import { KanbanColumn } from "./KanbanColumn";
import { commitDrop } from "./dnd";

const COLUMNS: { status: TaskStatus; label: string }[] = (
  ["todo", "in_progress", "done", "cancelled"] as const
).map((status) => ({ status, label: TASK_STATUS_LABELS[status] }));

/** Cards shown inline in any column before it defers to the archive view. */
const PREVIEW_LIMIT = 8;

/** Statuses where "most recently touched" (not "most recently created") is the useful order. */
const FINISHED_STATUSES: readonly TaskStatus[] = ["done", "cancelled"];

function byRecentActivity(a: Task, b: Task): number {
  const aTime = new Date(a.completedAt ?? a.updatedAt).getTime();
  const bTime = new Date(b.completedAt ?? b.updatedAt).getTime();
  return bTime - aTime;
}

export function KanbanBoard({ initialTasks }: { initialTasks: Task[] }) {
  const { tasks, setTasks } = useTasks(initialTasks);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent): void {
    void commitDrop(event, tasks, setTasks);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex snap-x gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.status);
          const isFinished = FINISHED_STATUSES.includes(column.status);
          return (
            <KanbanColumn
              key={column.status}
              status={column.status}
              label={column.label}
              tasks={isFinished ? [...columnTasks].sort(byRecentActivity) : columnTasks}
              maxVisible={PREVIEW_LIMIT}
              archiveHref={`/board/archive/${column.status}`}
            />
          );
        })}
      </div>
    </DndContext>
  );
}
