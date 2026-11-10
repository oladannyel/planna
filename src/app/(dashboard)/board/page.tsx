import { PageHeader } from "@/components/layout";
import { KanbanBoard } from "@/features/board";
import { ShareRequestLink, publicOrigin, requestLinkFor } from "@/features/request";
import { QuickAdd } from "@/features/tasks/QuickAdd";
import { TaskSheetProvider } from "@/features/tasks/TaskSheetProvider";
import { getTasks } from "@/features/tasks/queries";
import { getAuthedContext } from "@/features/workspace/queries";

export default async function BoardPage() {
  const result = await getTasks();
  const tasks = result.ok ? result.value : [];

  // Passed explicitly so the realtime subscription still opens on an empty
  // board, where there is no task row to infer the workspace from.
  const ctx = await getAuthedContext();
  const workspaceId = ctx.ok ? ctx.value.workspaceId : undefined;

  // The request link existed as a route long before anything in the app said
  // so, which made it a feature only its author could use. The slug lives on
  // the workspace row the context already loaded, so surfacing it costs no
  // extra query.
  const requestLink = ctx.ok ? requestLinkFor(await publicOrigin(), ctx.value.workspaceSlug) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Board"
        crumbs={[{ label: "Home", href: "/" }, { label: "Board" }]}
        {...(requestLink ? { action: <ShareRequestLink url={requestLink} /> } : {})}
      />
      <QuickAdd />
      <TaskSheetProvider>
        <KanbanBoard initialTasks={tasks} {...(workspaceId ? { workspaceId } : {})} />
      </TaskSheetProvider>
    </div>
  );
}
