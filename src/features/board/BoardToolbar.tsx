"use client";

import { Plus, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui";
import type { TaskStatus } from "@/features/tasks/types";
import { cn } from "@/lib/cn";

/** `null` means "All tasks". */
export type BoardFilter = TaskStatus | null;

export interface ToolbarTab {
  value: BoardFilter;
  label: string;
  count: number;
}

/**
 * Segmented status tabs with counts, plus the board actions — the control row
 * from the reference design.
 */
export function BoardToolbar({
  tabs,
  active,
  onSelect,
  onAddTask,
}: {
  tabs: ToolbarTab[];
  active: BoardFilter;
  onSelect: (next: BoardFilter) => void;
  onAddTask?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div
        role="tablist"
        aria-label="Filter tasks by status"
        className="scrollbar-thin flex items-center gap-1 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const isActive = tab.value === active;
          return (
            <button
              key={tab.label}
              role="tab"
              type="button"
              aria-selected={isActive}
              /*
               * Spelled out rather than left to name-from-content. The count
               * sits in its own <span> with no whitespace between, so the
               * computed name concatenates to "All tasks14" — correct per the
               * spec, and not what anyone wants read aloud.
               */
              aria-label={`${tab.label}, ${tab.count} ${tab.count === 1 ? "task" : "tasks"}`}
              onClick={() => onSelect(tab.value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple",
                isActive
                  ? "bg-purple/15 text-purple-ink"
                  : "text-text-secondary hover:bg-card-hover hover:text-text-primary",
              )}
            >
              {tab.label}
              <span
                aria-hidden="true"
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs",
                  isActive ? "bg-purple/20 text-purple-ink" : "bg-text-muted/15 text-text-muted",
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          startIcon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
          disabled
          title="Filtering and sorting arrive with a later phase"
        >
          Filter &amp; sort
        </Button>
        {onAddTask ? (
          <Button size="sm" onClick={onAddTask} endIcon={<Plus className="h-4 w-4" aria-hidden />}>
            Add task
          </Button>
        ) : null}
      </div>
    </div>
  );
}
