"use server";

import { revalidatePath } from "next/cache";

import { getAuthedContext } from "@/features/workspace/queries";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import type { Database, Json } from "@/types/database";

import { TASK_COLUMNS } from "./columns";
import { rowToTask } from "./mappers";
import { parseMultipleTasksFromText, parseTaskFromText } from "./parser";
import { taskInputSchema } from "./schema";
import type { Task, TaskInput, TaskSource, TaskStatus } from "./types";

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

/** A status-history entry as a JSON value for storage in the JSONB column. */
function statusEntry(status: TaskStatus): Json {
  return { status, changedAt: new Date().toISOString() };
}

const DEFAULT_DEADLINE_MS = 24 * 60 * 60 * 1000;

/** The default deadline for a new task: 24 hours from now. */
function defaultDueAt(): string {
  return new Date(Date.now() + DEFAULT_DEADLINE_MS).toISOString();
}

/** The date portion ("YYYY-MM-DD") of an ISO timestamp. */
function dateOf(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Resolve the deadline pair for an insert. `dueAt` wins; otherwise an explicit
 * `dueDate` is treated as end-of-day; otherwise the task defaults to 24h out.
 * `dueDate` is always kept in sync with `dueAt` for calendar/weekly grouping.
 */
function resolveDeadline(input: { dueAt?: string | undefined; dueDate?: string | undefined }): {
  dueAt: string;
  dueDate: string;
} {
  const dueAt = input.dueAt ?? (input.dueDate ? `${input.dueDate}T23:59:59.999Z` : defaultDueAt());
  return { dueAt, dueDate: input.dueDate ?? dateOf(dueAt) };
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

  const status = validated.data.status ?? "todo";
  const completedAt = status === "done" ? new Date().toISOString() : null;
  const deadline = resolveDeadline(validated.data);

  const { data, error } = await ctx.value.supabase
    .from("tasks")
    .insert({
      workspace_id: ctx.value.workspaceId,
      title: validated.data.title,
      description: validated.data.description ?? null,
      status,
      priority: validated.data.priority,
      tags: validated.data.tags,
      due_date: deadline.dueDate,
      due_at: deadline.dueAt,
      estimated_minutes: validated.data.estimatedMinutes ?? null,
      source,
      completed_at: completedAt,
      status_history: [statusEntry(status)],
    })
    .select(TASK_COLUMNS)
    .single();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
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
  // dueAt is the precise deadline; keep due_date (date-only, used for grouping) in sync.
  if (v.dueAt !== undefined) {
    patch.due_at = v.dueAt;
    patch.due_date = v.dueAt ? dateOf(v.dueAt) : null;
  }
  if (v.dueDate !== undefined) patch.due_date = v.dueDate;
  if (v.estimatedMinutes !== undefined) patch.estimated_minutes = v.estimatedMinutes;

  const { data, error } = await ctx.value.supabase
    .from("tasks")
    .update(patch)
    .eq("workspace_id", ctx.value.workspaceId)
    .eq("id", taskId)
    .select(TASK_COLUMNS)
    .single();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
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
    return err({ code: "DB_ERROR", message: rpcError.message });
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
    .select(TASK_COLUMNS)
    .single();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
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
    return err({ code: "DB_ERROR", message: error.message });
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

export interface BulkCreateResult {
  created: Task[];
  skipped: number;
  errors: string[];
}

/** Parse a multi-task blob and create every task above the confidence floor. */
export async function createMultipleTasksFromText(
  rawText: string,
): Promise<Result<BulkCreateResult>> {
  const parseResult = await parseMultipleTasksFromText(rawText);
  if (!parseResult.ok) return parseResult;

  const created: Task[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const item of parseResult.value) {
    if (item.confidence < 0.3) {
      skipped += 1;
      continue;
    }

    const input: TaskInput = {
      title: item.title,
      priority: item.priority,
      tags: item.tags,
      status: item.status,
      ...(item.description !== undefined ? { description: item.description } : {}),
      ...(item.dueDate !== null ? { dueDate: item.dueDate } : {}),
      ...(item.estimatedMinutes !== null ? { estimatedMinutes: item.estimatedMinutes } : {}),
    };

    const result = await createTask(input, "ai_parsed");
    if (result.ok) {
      created.push(result.value);
    } else {
      errors.push(`"${item.title}": ${result.error.message}`);
    }
  }

  revalidateTaskViews();
  return ok({ created, skipped, errors });
}
