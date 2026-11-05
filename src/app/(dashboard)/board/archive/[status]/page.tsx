import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout";
import { TaskCard } from "@/features/tasks/TaskCard";
import { TaskSheetProvider } from "@/features/tasks/TaskSheetProvider";
import { getTasksByStatus } from "@/features/tasks/queries";
import { isTaskStatus, TASK_STATUS_LABELS } from "@/features/tasks/status";

const PAGE_SIZE = 20;

function pageHref(status: string, search: string, page: number): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/board/archive/${status}?${qs}` : `/board/archive/${status}`;
}

export default async function StatusArchivePage({
  params,
  searchParams,
}: {
  params: Promise<{ status: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { status } = await params;
  if (!isTaskStatus(status)) notFound();

  const sp = await searchParams;
  const search = sp.q?.trim() ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const label = TASK_STATUS_LABELS[status];
  const lowerLabel = label.toLowerCase();

  const result = await getTasksByStatus(status, { page, pageSize: PAGE_SIZE, search });
  const { tasks, total } = result.ok ? result.value : { tasks: [], total: 0 };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          title={`${label} archive`}
          crumbs={[
            { label: "Home", href: "/" },
            { label: "Board", href: "/board" },
            { label: `${label} archive` },
          ]}
        />
        <p className="-mt-4 text-sm text-text-secondary">
          {total} {lowerLabel} {total === 1 ? "task" : "tasks"}
        </p>
      </div>

      <form className="flex gap-2" action={`/board/archive/${status}`}>
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder={`Search ${lowerLabel} tasks…`}
          className="w-full max-w-sm rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-text-primary shadow-theme-xs outline-none transition-colors placeholder:text-text-muted focus:border-purple focus:ring-4 focus:ring-purple/10"
        />
        <button
          type="submit"
          className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:border-purple/60 hover:text-purple"
        >
          Search
        </button>
      </form>

      <TaskSheetProvider>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-text-muted">
            {search ? `No ${lowerLabel} tasks match “${search}”.` : `No ${lowerLabel} tasks yet.`}
          </p>
        ) : null}
      </TaskSheetProvider>

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link href={pageHref(status, search, page - 1)} className="text-purple hover:underline">
              ← Prev
            </Link>
          ) : (
            <span className="text-text-muted">← Prev</span>
          )}
          <span className="text-text-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(status, search, page + 1)} className="text-purple hover:underline">
              Next →
            </Link>
          ) : (
            <span className="text-text-muted">Next →</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
