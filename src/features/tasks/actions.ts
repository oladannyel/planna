"use server";

import { revalidatePath } from "next/cache";

import { getAuthedContext } from "@/features/workspace/queries";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import type { Database, Json } from "@/types/database";

import { rowToTask } from "./mappers";
import { parseTaskFromText } from "./parser";
import { taskInputSchema } from "./schema";
import type { Task, TaskInput, TaskSource, TaskStatus } from "./types";

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

/** A status-history entry as a JSON value for storage in the JSONB column. */
function statusEntry(status: TaskStatus): Json {
  return { status, changedAt: new Date().toISOString() };
}

function revalidateTaskViews(): void {
  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath("/daily");
  revalidatePath("/weekly");
  revalidatePath("/analytics");
}

export async function createTask(
  input: TaskInput,
  source: TaskSource = "manual",
): Promise<Result<Task>> {
  const validated = taskInputSchema.safeParse(input);
  if (!validated.success) {
    return err({
      code: "VALIDATION_ERROR",
      message: "Invalid task input",
      fields: validated.error.flatten().fieldErrors,
    });
  }

  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.value.supabase
    .from("tasks")
    .insert({
      workspace_id: ctx.value.workspaceId,
      title: validated.data.title,
      description: validated.data.description ?? null,
      priority: validated.data.priority,
      tags: validated.data.tags,
      due_date: validated.data.dueDate ?? null,
      estimated_minutes: validated.data.estimatedMinutes ?? null,
      source,
      status_history: [statusEntry("todo")],
    })
    .select("*")
    .single();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message, cause: error });
  }

  revalidateTaskViews();
  return ok(rowToTask(data));
}

export async function updateTask(taskId: string, input: Partial<TaskInput>): Promise<Result<Task>> {
  const validated = taskInputSchema.partial().safeParse(input);
  if (!validated.success) {
    return err({
      code: "VALIDATION_ERROR",
      message: "Invalid task input",
      fields: validated.error.flatten().fieldErrors,
    });
  }

  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const patch: TaskUpdate = {};
  const v = validated.data;
  if (v.title !== undefined) patch.title = v.title;
  if (v.description !== undefined) patch.description = v.description;
  if (v.priority !== undefined) patch.priority = v.priority;
  if (v.tags !== undefined) patch.tags = v.tags;
  if (v.dueDate !== undefined) patch.due_date = v.dueDate;
  if (v.estimatedMinutes !== undefined) patch.estimated_minutes = v.estimatedMinutes;

  const { data, error } = await ctx.value.supabase
    .from("tasks")
    .update(patch)
    .eq("workspace_id", ctx.value.workspaceId)
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message, cause: error });
  }

  revalidateTaskViews();
  return ok(rowToTask(data));
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<Result<Task>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  // Append history atomically via the DB function, then update the row.
  const { error: rpcError } = await ctx.value.supabase.rpc("append_status_history", {
    task_id: taskId,
    entry: statusEntry(status),
  });
  if (rpcError) {
    return err({ code: "DB_ERROR", message: rpcError.message, cause: rpcError });
  }

  const patch: TaskUpdate = {
    status,
    completed_at: status === "done" ? new Date().toISOString() : null,
  };

  const { data, error } = await ctx.value.supabase
    .from("tasks")
    .update(patch)
    .eq("workspace_id", ctx.value.workspaceId)
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message, cause: error });
  }

  revalidateTaskViews();
  return ok(rowToTask(data));
}

export async function deleteTask(taskId: string): Promise<Result<{ id: string }>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { error } = await ctx.value.supabase
    .from("tasks")
    .delete()
    .eq("workspace_id", ctx.value.workspaceId)
    .eq("id", taskId);

  if (error) {
    return err({ code: "DB_ERROR", message: error.message, cause: error });
  }

  revalidateTaskViews();
  return ok({ id: taskId });
}

/** Parse free text with the AI parser, then create the resulting task. */
export async function createTaskFromText(
  rawText: string,
): Promise<Result<{ parsed: Task; confidence: number }>> {
  const parseResult = await parseTaskFromText(rawText);
  if (!parseResult.ok) return parseResult;

  const parsed = parseResult.value;
  const input: TaskInput = {
    title: parsed.title,
    priority: parsed.priority,
    tags: parsed.tags,
    ...(parsed.dueDate !== null ? { dueDate: parsed.dueDate } : {}),
    ...(parsed.estimatedMinutes !== null ? { estimatedMinutes: parsed.estimatedMinutes } : {}),
  };

  const createResult = await createTask(input, "ai_parsed");
  if (!createResult.ok) return createResult;

  return ok({ parsed: createResult.value, confidence: parsed.confidence });
}
