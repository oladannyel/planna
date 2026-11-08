"use client";

import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { useMemo, useState } from "react";

import { TASK_STATUS_LABELS } from "@/features/tasks/status";
import type { Task, TaskStatus } from "@/features/tasks/types";
import { useTasks } from "@/hooks/useTasks";

import { BoardToolbar } from "./BoardToolbar";
import type { BoardFilter, ToolbarTab } from "./BoardToolbar";
import { KanbanColumn } from "./KanbanColumn";
import { commitDrop } from "./dnd";

/** All four plAnna statuses keep their own column (decision D8). */
const STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;

const COLUMNS: { status: TaskStatus; label: string }[] = STATUSES.map((status) => ({
  status,
  label: TASK_STATUS_LABELS[status],
}));

/** Cards shown inline in any column before it defers to the archive view. */
const PREVIEW_LIMIT = 8;

/** Statuses where "most recently touched" beats "most recently created". */
const FINISHED_STATUSES: readonly TaskStatus[] = ["done", "cancelled"];

function byRecentActivity(a: Task, b: Task): number {
  const aTime = new Date(a.completedAt ?? a.updatedAt).getTime();
  const bTime = new Date(b.completedAt ?? b.updatedAt).getTime();
  return bTime - aTime;
}

export function KanbanBoard({
  initialTasks,
  workspaceId,
}: {
  initialTasks: Task[];
  workspaceId?: string;
}) {
  const { tasks, setTasks } = useTasks(initialTasks, workspaceId);
  const [filter, setFilter] = useState<BoardFilter>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Keyboard dragging, so the board is not pointer-only.
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent): void {
    void commitDrop(event, tasks, setTasks);
  }

  const tabs: ToolbarTab[] = useMemo(
    () => [
      { value: null, label: "All tasks", count: tasks.length },
      ...COLUMNS.map((column) => ({
        value: column.status,
        label: column.label,
        count: tasks.filter((task) => task.status === column.status).length,
      })),
    ],
    [tasks],
  );

  const visibleColumns = filter ? COLUMNS.filter((c) => c.status === filter) : COLUMNS;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="surface overflow-hidden">
        <BoardToolbar tabs={tabs} active={filter} onSelect={setFilter} />

        <div className="flex snap-x overflow-x-auto">
          {visibleColumns.map((column) => {
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
      </div>
    </DndContext>
  );
}
