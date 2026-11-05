"use client";

import { useState } from "react";

import { TaskCard } from "@/features/tasks/TaskCard";
import type { Task } from "@/features/tasks/types";
import { cn } from "@/lib/cn";

import type { CalendarDay, DayDot } from "./calendar";

const DOT_COLOR: Record<DayDot, string> = {
  done: "bg-teal",
  in_progress: "bg-amber",
  overdue: "bg-danger",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface MonthlyCalendarProps {
  weeks: CalendarDay[][];
  dots: Record<string, DayDot[]>;
  tasks: Task[];
}

export function MonthlyCalendar({ weeks, dots, tasks }: MonthlyCalendarProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const dayTasks = selected
    ? tasks.filter(
        (task) =>
          task.dueDate === selected ||
          (task.completedAt !== null && task.completedAt.slice(0, 10) === selected),
      )
    : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="py-1 text-center text-xs text-text-muted">
            {weekday}
          </div>
        ))}

        {weeks.flat().map((day) => {
          const dayDotsForCell = dots[day.date] ?? [];
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => setSelected(day.date)}
              aria-label={day.date}
              className={cn(
                "aspect-square rounded-lg border border-border p-1 text-left align-top text-xs",
                !day.inMonth && "opacity-40",
                selected === day.date && "ring-1 ring-purple",
              )}
            >
              <span>{day.day}</span>
              <span className="mt-1 flex flex-wrap gap-0.5">
                {dayDotsForCell.slice(0, 4).map((dot, index) => (
                  <span
                    key={`${dot}-${String(index)}`}
                    className={cn("h-1.5 w-1.5 rounded-full", DOT_COLOR[dot])}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {selected !== null ? (
        <div className="surface p-4">
          <h3 className="text-sm font-medium">{selected}</h3>
          {dayTasks.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No tasks on this day.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {dayTasks.map((task) => (
                <li key={task.id}>
                  <TaskCard task={task} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
