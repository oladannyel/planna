import { TaskCard } from "@/features/tasks/TaskCard";
import type { Task } from "@/features/tasks/types";

import type { WeekDay } from "./week";

export function WeekColumn({ day, tasks }: { day: WeekDay; tasks: Task[] }) {
  return (
    <section className="flex min-w-[12rem] flex-col rounded-xl border border-border bg-card/40 md:min-w-0">
      <header className="border-b border-border px-3 py-2">
        <p className="text-sm font-medium">{day.weekday}</p>
        <p className="text-xs text-text-muted">{day.label}</p>
      </header>
      <div className="flex flex-col gap-2 p-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 ? <p className="px-1 py-3 text-xs text-text-muted">—</p> : null}
      </div>
    </section>
  );
}
