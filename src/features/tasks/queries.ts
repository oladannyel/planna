import { startOfToday } from "date-fns";

import { getAuthedContext } from "@/features/workspace/queries";
import { requestMemo } from "@/lib/request-memo";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";

import { TASK_COLUMNS } from "./columns";
import { rowToTask } from "./mappers";
import type { Task, TaskStatus } from "./types";

/**
 * All tasks in the caller's workspace, newest first.
 *
 * Memoized per request with React `cache`. The dashboard layout and the page
 * beneath it both need tasks, and without this a single navigation fetched the
 * whole table twice. At 788 bytes a row, a 1,000-task workspace was shipping
 * ~1.5 MB per page view to draw one board.
 */
export const getTasks = requestMemo(async function getTasks(): Promise<Result<Task[]>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.value.supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("workspace_id", ctx.value.workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  return ok(data.map(rowToTask));
});

/**
 * How many open tasks were created before today — the carryover count the
 * dashboard layout badges on every route.
 *
 * Deliberately a count, not a fetch. The layout previously pulled every task
 * row across the wire and called `detectCarryovers` on the result purely to
 * read `.length`. `head: true` returns the count in a header and no rows at
 * all, so this costs effectively nothing regardless of workspace size.
 *
 * The predicate must stay in step with `detectCarryovers`: open status
 * (todo / in_progress) and created before the start of today.
 */
export const countCarryovers = requestMemo(async function countCarryovers(): Promise<
  Result<number>
> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { count, error } = await ctx.value.supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ctx.value.workspaceId)
    .in("status", ["todo", "in_progress"])
    .lt("created_at", startOfToday().toISOString());

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  return ok(count ?? 0);
});

/** A single task by id, scoped to the caller's workspace. */
export async function getTaskById(taskId: string): Promise<Result<Task>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.value.supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("workspace_id", ctx.value.workspaceId)
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }
  if (!data) {
    return err({ code: "NOT_FOUND", message: "Task not found" });
  }

  return ok(rowToTask(data));
}

export interface TasksPage {
  tasks: Task[];
  total: number;
}

/**
 * One page of tasks in a given status, newest-completed first, optionally
 * filtered by title. Backs the archive view so large Done/Cancelled history
 * doesn't have to be fetched or rendered all at once.
 */
export async function getTasksByStatus(
  status: TaskStatus,
  {
    page = 1,
    pageSize = 20,
    search = "",
  }: { page?: number; pageSize?: number; search?: string } = {},
): Promise<Result<TasksPage>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = ctx.value.supabase
    .from("tasks")
    .select("*", { count: "exact" })
    .eq("workspace_id", ctx.value.workspaceId)
    .eq("status", status);

  if (search.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  const { data, error, count } = await query
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  return ok({ tasks: data.map(rowToTask), total: count ?? 0 });
}

/** Tasks whose due date falls within [start, end] (inclusive ISO dates). */
export async function getTasksInRange(start: string, end: string): Promise<Result<Task[]>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.value.supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("workspace_id", ctx.value.workspaceId)
    .gte("due_date", start)
    .lte("due_date", end)
    .order("due_date", { ascending: true });

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  return ok(data.map(rowToTask));
}
