import { CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/shared";
import { TaskCard } from "@/features/tasks/TaskCard";
import { TASK_AGE_HEADINGS, groupByAge, sortDailyTasks } from "@/features/tasks/carryover";
import type { TaskAge } from "@/features/tasks/carryover";
import type { Task } from "@/features/tasks/types";

import { CarryoverBanner } from "./CarryoverBanner";
import { StreakCounter } from "./StreakCounter";

interface DailyViewProps {
  tasks: Task[];
  carryoverCount: number;
  streak: number;
  /** Injectable for deterministic tests; defaults to the current day. */
  today?: Date;
}

/*
 * Oldest first: what has been waiting longest leads the day, and today's new
 * work sits at the bottom where it was added.
 */
const SECTION_ORDER: readonly TaskAge[] = ["older", "yesterday", "today"];

export function DailyView({ tasks, carryoverCount, streak, today }: DailyViewProps) {
  const grouped = groupByAge(tasks, today);
  const sections = SECTION_ORDER.map((age) => ({
    age,
    heading: TASK_AGE_HEADINGS[age],
    tasks: sortDailyTasks(grouped[age]),
  })).filter((section) => section.tasks.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-title-md font-bold text-text-primary">Today</h1>
        <StreakCounter streak={streak} />
      </div>

      <CarryoverBanner count={carryoverCount} />

      {sections.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nothing scheduled"
          message="You're all caught up. Add a task to get started."
        />
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.age} aria-labelledby={`daily-${section.age}`}>
              <div className="mb-2 flex items-center gap-2">
                <h2
                  id={`daily-${section.age}`}
                  className="text-xs font-semibold uppercase tracking-wide text-text-secondary"
                >
                  {section.heading}
                </h2>
                <span className="rounded-full bg-text-muted/15 px-2 py-0.5 text-xs font-medium text-text-muted">
                  {section.tasks.length}
                </span>
              </div>
              <ul className="space-y-2">
                {section.tasks.map((task) => (
                  <li key={task.id}>
                    <TaskCard task={task} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
