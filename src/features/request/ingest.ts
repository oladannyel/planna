import { parseTaskFromText } from "@/features/tasks/parser";
import type { RequestInputSchema } from "@/features/tasks/schema";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * Core request-link ingestion: resolve the workspace by slug (service role),
 * AI-enrich the submission, and insert a `request_link` task. Shared by the
 * public API route and the `submitRequest` server action.
 */
export async function ingestRequest(
  input: RequestInputSchema,
): Promise<Result<{ taskId: string }>> {
  const admin = createAdminClient();

  const { data: workspace, error: wsError } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", input.slug)
    .maybeSingle();

  if (wsError) {
    return err({ code: "DB_ERROR", message: wsError.message });
  }
  if (!workspace) {
    return err({ code: "NOT_FOUND", message: "Workspace not found" });
  }

  const rawText = `${input.title}. ${input.description}. Priority: ${input.urgency}.${
    input.desiredDeadline ? ` Deadline: ${input.desiredDeadline}` : ""
  }`;
  const parseResult = await parseTaskFromText(rawText);
  const parsed = parseResult.ok ? parseResult.value : null;

  const initialHistory: Json[] = [{ status: "todo", changedAt: new Date().toISOString() }];

  const { data, error } = await admin
    .from("tasks")
    .insert({
      workspace_id: workspace.id,
      title: parsed?.title ?? input.title,
      description: input.description,
      priority: parsed?.priority ?? input.urgency,
      tags: parsed?.tags ?? [],
      due_date: parsed?.dueDate ?? input.desiredDeadline ?? null,
      estimated_minutes: parsed?.estimatedMinutes ?? null,
      source: "request_link",
      requested_by: input.requesterName,
      status_history: initialHistory,
    })
    .select("id")
    .single();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  return ok({ taskId: data.id });
}
