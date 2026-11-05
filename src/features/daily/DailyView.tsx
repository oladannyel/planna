import { CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/shared";
import { TaskCard } from "@/features/tasks/TaskCard";
import { sortDailyTasks } from "@/features/tasks/carryover";
import type { Task } from "@/features/tasks/types";

import { CarryoverBanner } from "./CarryoverBanner";
import { StreakCounter } from "./StreakCounter";

interface DailyViewProps {
  tasks: Task[];
  carryoverCount: number;
  streak: number;
}

export function DailyView({ tasks, carryoverCount, streak }: DailyViewProps) {
  const ordered = sortDailyTasks(tasks);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-title-md font-bold text-text-primary">Today</h1>
        <StreakCounter streak={streak} />
      </div>

      <CarryoverBanner count={carryoverCount} />

      {ordered.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nothing scheduled"
          message="You're all caught up. Add a task to get started."
        />
      ) : (
        <ul className="space-y-2">
          {ordered.map((task) => (
            <li key={task.id}>
              <TaskCard task={task} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
