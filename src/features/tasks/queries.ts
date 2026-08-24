import { getAuthedContext } from "@/features/workspace/queries";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";

import { rowToTask } from "./mappers";
import type { Task, TaskStatus } from "./types";

/** All tasks in the caller's workspace, newest first. */
export async function getTasks(): Promise<Result<Task[]>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.value.supabase
    .from("tasks")
    .select("*")
    .eq("workspace_id", ctx.value.workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  return ok(data.map(rowToTask));
}

/** A single task by id, scoped to the caller's workspace. */
export async function getTaskById(taskId: string): Promise<Result<Task>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.value.supabase
    .from("tasks")
    .select("*")
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
    .select("*")
    .eq("workspace_id", ctx.value.workspaceId)
    .gte("due_date", start)
    .lte("due_date", end)
    .order("due_date", { ascending: true });

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  return ok(data.map(rowToTask));
}
