import { z } from "zod";

import type { Database } from "@/types/database";

import type { StatusHistoryEntry, Task } from "./types";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

const statusHistorySchema: z.ZodType<StatusHistoryEntry[]> = z.array(
  z.object({
    status: z.enum(["todo", "in_progress", "done", "cancelled"]),
    changedAt: z.string(),
  }),
);

/**
 * Safely parse the JSONB `status_history` column into typed entries.
 * Returns `[]` for null/legacy/malformed data rather than throwing — the
 * history is advisory, never load-bearing for correctness.
 */
function parseStatusHistory(value: unknown): StatusHistoryEntry[] {
  const result = statusHistorySchema.safeParse(value);
  return result.success ? result.data : [];
}

/** Map a Supabase `tasks` row (snake_case) to the camelCase domain `Task`. */
export function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    tags: row.tags,
    dueDate: row.due_date ?? null,
    // Coalesce undefined → null so consumers are safe even before the due_at
    // migration has been applied (a missing column reads back as undefined).
    dueAt: row.due_at ?? null,
    estimatedMinutes: row.estimated_minutes,
    source: row.source,
    requestedBy: row.requested_by,
    carriedOver: row.carried_over,
    carryCount: row.carry_count,
    statusHistory: parseStatusHistory(row.status_history),
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
