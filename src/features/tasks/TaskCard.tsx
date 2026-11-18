"use client";

import { CalendarDays, Repeat2 } from "lucide-react";

import { Badge } from "@/components/shared";
import { cn } from "@/lib/cn";

import { useTaskSheet } from "./TaskSheetProvider";
import { daysOld, isOpenTask } from "./carryover";
import type { Task, TaskPriority } from "./types";

/** Priority shows as a left edge — colour without spending a badge slot. */
const PRIORITY_EDGE: Record<TaskPriority, string> = {
  low: "before:bg-text-muted",
  medium: "before:bg-purple",
  high: "before:bg-amber",
  urgent: "before:bg-danger",
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority",
  urgent: "Urgent",
};

/** Deadline: date plus time when a precise dueAt exists, otherwise the date. */
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

/**
 * Age badge: how long an open task has been waiting. Derived from `createdAt`
 * rather than read from `carryCount`, which nothing in the app has ever
 * written — the old badge always read "0". Finished tasks are left alone,
 * since the age of something already done is just noise.
 */
function ageBadge(task: Task): { short: string; title: string } | null {
  if (!isOpenTask(task)) return null;
  const days = daysOld(task);
  if (days < 1) return null;
  return {
    short: `${days}d`,
    title: days === 1 ? "Carried over from yesterday" : `Carried over for ${days} days`,
  };
}

export function TaskCard({ task }: { task: Task }) {
  const { open } = useTaskSheet();
  const deadline = deadlineLabel(task);
  const age = ageBadge(task);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        open(task);
      }}
      className={cn(
        "surface group relative block w-full overflow-hidden p-4 text-start",
        "before:absolute before:inset-y-0 before:start-0 before:w-1 before:content-['']",
        "transition-shadow hover:shadow-theme-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple",
        PRIORITY_EDGE[task.priority],
      )}
    >
      <span className="sr-only">{PRIORITY_LABEL[task.priority]}</span>

      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug text-text-primary">{task.title}</h3>
        {age ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-medium text-amber"
            title={age.title}
          >
            <Repeat2 className="h-3 w-3" aria-hidden />
            {age.short}
          </span>
        ) : null}
      </div>

      {task.description ? (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-secondary">
          {task.description}
        </p>
      ) : null}

      {/* Meta row — the reference's calendar/counters line. */}
      {deadline || task.source === "request_link" ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
          {deadline ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {deadline}
            </span>
          ) : null}
          {task.source === "request_link" && task.requestedBy ? (
            <span className="truncate text-purple-ink">from {task.requestedBy}</span>
          ) : null}
        </div>
      ) : null}

      {task.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {task.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} tone="brand">
              {tag}
            </Badge>
          ))}
          {task.tags.length > 3 ? <Badge tone="muted">+{task.tags.length - 3}</Badge> : null}
        </div>
      ) : null}
    </button>
  );
}
