import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import type { Task } from "@/features/tasks/types";

import { WeekColumn } from "./WeekColumn";
import type { WeekDay } from "./week";

interface WeeklyPlannerProps {
  days: WeekDay[];
  buckets: Record<string, Task[]>;
  prevWeek: string;
  nextWeek: string;
}

export function WeeklyPlanner({ days, buckets, prevWeek, nextWeek }: WeeklyPlannerProps) {
  const first = days[0];
  const last = days[days.length - 1];
  const range = first && last ? `${first.label} – ${last.label}` : "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-title-md font-bold text-text-primary">Weekly</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/weekly?week=${prevWeek}`}
            aria-label="Previous week"
            className="rounded-lg border border-border p-1.5 text-text-secondary hover:text-text-primary"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <span className="text-sm text-text-secondary">{range}</span>
          <Link
            href={`/weekly?week=${nextWeek}`}
            aria-label="Next week"
            className="rounded-lg border border-border p-1.5 text-text-secondary hover:text-text-primary"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="grid grid-flow-col gap-3 overflow-x-auto pb-4 md:grid-flow-row md:grid-cols-7">
        {days.map((day) => (
          <WeekColumn key={day.date} day={day} tasks={buckets[day.date] ?? []} />
        ))}
      </div>
    </div>
  );
}
