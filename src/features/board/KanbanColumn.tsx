"use client";

import { useDroppable } from "@dnd-kit/core";

import type { Task, TaskStatus } from "@/features/tasks/types";
import { cn } from "@/lib/cn";

import { DraggableTaskCard } from "./DraggableTaskCard";

interface KanbanColumnProps {
  status: TaskStatus;
  label: string;
  tasks: Task[];
}

export function KanbanColumn({ status, label, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 snap-start flex-col rounded-xl border border-border bg-card/40",
        isOver && "ring-1 ring-purple",
      )}
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-sm font-medium">{label}</h2>
        <span className="rounded-md bg-border px-1.5 py-0.5 text-xs text-text-secondary">
          {tasks.length}
        </span>
      </header>

      <div className="flex flex-col gap-2 p-2">
        {tasks.map((task) => (
          <DraggableTaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 ? <p className="px-1 py-4 text-xs text-text-muted">No tasks</p> : null}
      </div>
    </section>
  );
}
