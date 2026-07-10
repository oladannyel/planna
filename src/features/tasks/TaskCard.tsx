"use client";

import { PriorityBadge, StatusBadge } from "@/components/shared";
import { cn } from "@/lib/cn";

import { useTaskSheet } from "./TaskSheetProvider";
import type { Task, TaskPriority } from "./types";

const PRIORITY_BORDER: Record<TaskPriority, string> = {
  low: "border-l-text-muted",
  medium: "border-l-purple",
  high: "border-l-amber",
  urgent: "border-l-danger",
};

/** Human-readable deadline: date + time when a precise dueAt exists, else the date. */
function deadlineLabel(task: Task): string | null {
  if (task.dueAt) {
    const d = new Date(task.dueAt);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  }
  return task.dueDate;
}

export function TaskCard({ task }: { task: Task }) {
  const { open } = useTaskSheet();
  const deadline = deadlineLabel(task);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        open(task);
      }}
      className={cn(
        "relative block w-full rounded-xl border border-l-4 border-border bg-card p-3 text-left transition-colors hover:border-purple/60",
        PRIORITY_BORDER[task.priority],
      )}
    >
      {task.carriedOver ? (
        <span className="absolute right-2 top-2 rounded-md bg-amber/20 px-1.5 py-0.5 text-[10px] font-medium text-amber">
          Carried ×{task.carryCount}
        </span>
      ) : null}

      <h3 className="pr-16 text-sm font-medium">{task.title}</h3>

      {task.source === "request_link" && task.requestedBy ? (
        <p className="mt-0.5 text-xs text-purple">Requested by {task.requestedBy}</p>
      ) : null}

      {task.description ? (
        <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{task.description}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
        <StatusBadge status={task.status} />
        {deadline ? <span className="text-xs text-text-muted">{deadline}</span> : null}
      </div>
    </button>
  );
}
