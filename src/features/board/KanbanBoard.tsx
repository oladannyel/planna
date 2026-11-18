"use client";

import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { useMemo, useState } from "react";

import { TASK_AGES, TASK_AGE_LABELS, groupByAge } from "@/features/tasks/carryover";
import { TASK_STATUS_LABELS } from "@/features/tasks/status";
import type { Task, TaskStatus } from "@/features/tasks/types";
import { useTasks } from "@/hooks/useTasks";

import { BoardToolbar } from "./BoardToolbar";
import type { AgeTab, BoardAgeFilter, BoardFilter, ToolbarTab } from "./BoardToolbar";
import { KanbanColumn } from "./KanbanColumn";
import { commitDrop } from "./dnd";
import { createColumnCoordinateGetter } from "./keyboard-coordinates";

/** All four plAnna statuses keep their own column (decision D8). */
const STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;

/** One arrow press moves one column; see keyboard-coordinates.ts. */
const columnCoordinateGetter = createColumnCoordinateGetter(STATUSES);

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
  const [ageFilter, setAgeFilter] = useState<BoardAgeFilter>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    /*
     * Keyboard dragging, so the board is not pointer-only — with a
     * coordinate getter that moves a whole column per arrow press. dnd-kit's
     * default steps a flat 25px, which on these columns is ten presses to
     * move one task one column: reachable by keyboard, but not usable by it.
     */
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinateGetter }),
  );

  function handleDragEnd(event: DragEndEvent): void {
    void commitDrop(event, tasks, setTasks);
  }

  /*
   * Age buckets are derived from `created_at` on every render rather than read
   * from the `carried_over` column, which nothing writes. Grouped once here so
   * the age counts and the filtered list cannot disagree.
   */
  const byAge = useMemo(() => groupByAge(tasks), [tasks]);

  const ageTabs: AgeTab[] = useMemo(
    () => [
      { value: null, label: "Any day", count: tasks.length },
      ...TASK_AGES.map((age) => ({
        value: age,
        label: TASK_AGE_LABELS[age],
        count: byAge[age].length,
      })),
    ],
    [byAge, tasks.length],
  );

  /* The age choice narrows the board first; status counts follow from it. */
  const scoped = ageFilter ? byAge[ageFilter] : tasks;

  const tabs: ToolbarTab[] = useMemo(
    () => [
      { value: null, label: "All tasks", count: scoped.length },
      ...COLUMNS.map((column) => ({
        value: column.status,
        label: column.label,
        count: scoped.filter((task) => task.status === column.status).length,
      })),
    ],
    [scoped],
  );

  const visibleColumns = filter ? COLUMNS.filter((c) => c.status === filter) : COLUMNS;

  /*
   * DndContext gets an explicit `id` because without one dnd-kit derives its
   * accessibility ids from a counter that restarts on the server and on the
   * client. Every card then hydrated with a mismatched `aria-describedby`
   * pointing at an element absent from the server HTML — React warned about
   * the tree on every board render.
   */

  return (
    <DndContext id="planna-board" sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="surface overflow-hidden">
        <BoardToolbar
          tabs={tabs}
          active={filter}
          onSelect={setFilter}
          ageTabs={ageTabs}
          activeAge={ageFilter}
          onSelectAge={setAgeFilter}
        />

        <div className="flex snap-x overflow-x-auto">
          {visibleColumns.map((column) => {
            const columnTasks = scoped.filter((task) => task.status === column.status);
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
