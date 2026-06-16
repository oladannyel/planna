"use client";

import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";

import type { Task, TaskStatus } from "@/features/tasks/types";
import { useTasks } from "@/hooks/useTasks";

import { KanbanColumn } from "./KanbanColumn";
import { commitDrop } from "./dnd";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "done", label: "Done" },
  { status: "cancelled", label: "Cancelled" },
];

export function KanbanBoard({ initialTasks }: { initialTasks: Task[] }) {
  const { tasks, setTasks } = useTasks(initialTasks);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent): void {
    void commitDrop(event, tasks, setTasks);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex snap-x gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.status}
            status={column.status}
            label={column.label}
            tasks={tasks.filter((task) => task.status === column.status)}
          />
        ))}
      </div>
    </DndContext>
  );
}
