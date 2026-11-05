"use client";

import { useDroppable } from "@dnd-kit/core";
import Link from "next/link";

import type { Task, TaskStatus } from "@/features/tasks/types";
import { cn } from "@/lib/cn";

import { DraggableTaskCard } from "./DraggableTaskCard";

interface KanbanColumnProps {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  /** Cap how many cards render inline; the rest are reachable via `archiveHref`. */
  maxVisible?: number;
  archiveHref?: string;
}

export function KanbanColumn({ status, label, tasks, maxVisible, archiveHref }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const visibleTasks = maxVisible ? tasks.slice(0, maxVisible) : tasks;
  const hiddenCount = tasks.length - visibleTasks.length;

  return (
    <section
      ref={setNodeRef}
      aria-label={`${label}, ${tasks.length} tasks`}
      className={cn(
        "flex w-[300px] shrink-0 snap-start flex-col transition-colors lg:w-auto lg:flex-1",
        // Columns are divided within one container rather than floating as
        // separate cards — the reference's single-surface board.
        "border-e border-border last:border-e-0",
        isOver && "bg-purple/5",
      )}
    >
      <header className="flex items-center gap-2 px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">{label}</h2>
        <span className="rounded-full bg-text-muted/15 px-2 py-0.5 text-xs font-medium text-text-muted">
          {tasks.length}
        </span>
      </header>

      <div className="scrollbar-thin flex flex-1 flex-col gap-3 px-3 pb-4">
        {visibleTasks.map((task) => (
          <DraggableTaskCard key={task.id} task={task} />
        ))}

        {tasks.length === 0 ? (
          <p
            className={cn(
              "rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-text-muted transition-colors",
              isOver && "border-purple/60 text-purple-ink",
            )}
          >
            {isOver ? "Drop here" : "No tasks"}
          </p>
        ) : null}

        {hiddenCount > 0 && archiveHref ? (
          <Link
            href={archiveHref}
            className="rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-text-secondary transition-colors hover:border-purple/60 hover:text-purple-ink"
          >
            View all {tasks.length} →
          </Link>
        ) : null}
      </div>
    </section>
  );
}
