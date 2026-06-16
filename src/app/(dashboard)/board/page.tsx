import { KanbanBoard } from "@/features/board";
import { QuickAdd } from "@/features/tasks/QuickAdd";
import { getTasks } from "@/features/tasks/queries";

export default async function BoardPage() {
  const result = await getTasks();
  const tasks = result.ok ? result.value : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Board</h1>
      <QuickAdd />
      <KanbanBoard initialTasks={tasks} />
    </div>
  );
}
