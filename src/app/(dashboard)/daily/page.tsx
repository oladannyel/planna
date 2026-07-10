import { DailyView } from "@/features/daily";
import { completedDates, computeCurrentStreak } from "@/features/daily/streak";
import { QuickAdd } from "@/features/tasks/QuickAdd";
import { TaskSheetProvider } from "@/features/tasks/TaskSheetProvider";
import { detectCarryovers } from "@/features/tasks/carryover";
import { getTasks } from "@/features/tasks/queries";

export default async function DailyPage() {
  const result = await getTasks();
  const tasks = result.ok ? result.value : [];

  const open = tasks.filter((task) => task.status === "todo" || task.status === "in_progress");
  const carryoverIds = new Set(detectCarryovers(open).map((task) => task.id));
  const display = open.map((task) =>
    carryoverIds.has(task.id) ? { ...task, carriedOver: true } : task,
  );
  const streak = computeCurrentStreak(completedDates(tasks), new Date());

  return (
    <div className="space-y-6">
      <QuickAdd />
      <TaskSheetProvider>
        <DailyView tasks={display} carryoverCount={carryoverIds.size} streak={streak} />
      </TaskSheetProvider>
    </div>
  );
}
