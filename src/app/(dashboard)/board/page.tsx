import { PageHeader } from "@/components/layout";
import { KanbanBoard } from "@/features/board";
import { QuickAdd } from "@/features/tasks/QuickAdd";
import { TaskSheetProvider } from "@/features/tasks/TaskSheetProvider";
import { getTasks } from "@/features/tasks/queries";

export default async function BoardPage() {
  const result = await getTasks();
  const tasks = result.ok ? result.value : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Board" crumbs={[{ label: "Home", href: "/" }, { label: "Board" }]} />
      <QuickAdd />
      <TaskSheetProvider>
        <KanbanBoard initialTasks={tasks} />
      </TaskSheetProvider>
    </div>
  );
}
