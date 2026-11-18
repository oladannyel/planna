"use client";

import { Plus, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui";
import type { TaskAge } from "@/features/tasks/carryover";
import type { TaskStatus } from "@/features/tasks/types";
import { cn } from "@/lib/cn";

/** `null` means "All tasks". */
export type BoardFilter = TaskStatus | null;

export interface ToolbarTab {
  value: BoardFilter;
  label: string;
  count: number;
}

/** `null` means "any age". */
export type BoardAgeFilter = TaskAge | null;

export interface AgeTab {
  value: BoardAgeFilter;
  label: string;
  count: number;
}

/** One segmented tab. Shared by the status row and the age row. */
function FilterTab({
  label,
  count,
  isActive,
  size = "md",
  onSelect,
}: {
  label: string;
  count: number;
  isActive: boolean;
  size?: "md" | "sm";
  onSelect: () => void;
}) {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      /*
       * Spelled out rather than left to name-from-content. The count
       * sits in its own <span> with no whitespace between, so the
       * computed name concatenates to "All tasks14" — correct per the
       * spec, and not what anyone wants read aloud.
       */
      aria-label={`${label}, ${count} ${count === 1 ? "task" : "tasks"}`}
      onClick={onSelect}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-lg font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple",
        size === "md" ? "px-3 py-2 text-sm" : "px-2.5 py-1 text-xs",
        isActive
          ? "bg-purple/15 text-purple-ink"
          : "text-text-secondary hover:bg-card-hover hover:text-text-primary",
      )}
    >
      {label}
      <span
        aria-hidden="true"
        className={cn(
          "rounded-full px-1.5 py-0.5 text-xs",
          isActive ? "bg-purple/20 text-purple-ink" : "bg-text-muted/15 text-text-muted",
        )}
      >
        {count}
      </span>
    </button>
  );
}

/**
 * Segmented status tabs with counts and an age row, plus the board actions —
 * the control row from the reference design.
 */
export function BoardToolbar({
  tabs,
  active,
  onSelect,
  ageTabs,
  activeAge = null,
  onSelectAge,
  onAddTask,
}: {
  tabs: ToolbarTab[];
  active: BoardFilter;
  onSelect: (next: BoardFilter) => void;
  /** Age row. Omitted (with `onSelectAge`) when a board has no use for it. */
  ageTabs?: AgeTab[];
  activeAge?: BoardAgeFilter;
  onSelectAge?: (next: BoardAgeFilter) => void;
  onAddTask?: () => void;
}) {
  const showAgeRow = Boolean(ageTabs && ageTabs.length > 0 && onSelectAge);

  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Filter tasks by status"
          className="scrollbar-thin flex items-center gap-1 overflow-x-auto"
        >
          {tabs.map((tab) => (
            <FilterTab
              key={tab.label}
              label={tab.label}
              count={tab.count}
              isActive={tab.value === active}
              onSelect={() => onSelect(tab.value)}
            />
          ))}
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
            <Button
              size="sm"
              onClick={onAddTask}
              endIcon={<Plus className="h-4 w-4" aria-hidden />}
            >
              Add task
            </Button>
          ) : null}
        </div>
      </div>

      {/*
       * Age row: which day a task was created on, so today's work is
       * separable from what has been carried over. Counts come from the
       * same task list as the status tabs above.
       */}
      {showAgeRow && ageTabs && onSelectAge ? (
        <div
          role="tablist"
          aria-label="Filter tasks by age"
          className="scrollbar-thin flex items-center gap-1 overflow-x-auto"
        >
          {ageTabs.map((tab) => (
            <FilterTab
              key={tab.label}
              label={tab.label}
              count={tab.count}
              size="sm"
              isActive={tab.value === activeAge}
              onSelect={() => onSelectAge(tab.value)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
