import { getAuthedContext } from "@/features/workspace/queries";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";

import { rowToTask } from "./mappers";
import type { Task } from "./types";

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
    return err({ code: "DB_ERROR", message: error.message, cause: error });
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
    return err({ code: "DB_ERROR", message: error.message, cause: error });
  }
  if (!data) {
    return err({ code: "NOT_FOUND", message: "Task not found" });
  }

  return ok(rowToTask(data));
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
    return err({ code: "DB_ERROR", message: error.message, cause: error });
  }

  return ok(data.map(rowToTask));
}
