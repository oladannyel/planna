import { parseTaskFromText } from "@/features/tasks/parser";
import type { RequestInputSchema } from "@/features/tasks/schema";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * How many request-link tasks one workspace will accept per hour.
 *
 * Request links are unauthenticated by design: anyone holding the slug can
 * file a task. That makes this the only path where a stranger can cause the
 * workspace owner to spend money — each submission runs a language-model call
 * — and fill their board. A cap is the difference between a public form and
 * an open quota drain.
 *
 * Generous enough that a real team filing requests never notices it.
 */
export const REQUEST_HOURLY_LIMIT = 20;

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Core request-link ingestion: resolve the workspace by slug (service role),
 * AI-enrich the submission, and insert a `request_link` task. Shared by the
 * public API route and the `submitRequest` server action.
 *
 * The throttle is checked *before* the model call, not after. Rejecting an
 * abusive request only once it has already been parsed would still let an
 * attacker burn the owner's AI quota at will, which is the expensive half of
 * the attack.
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

  const since = new Date(Date.now() - ONE_HOUR_MS).toISOString();
  const { count, error: countError } = await admin
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id)
    .eq("source", "request_link")
    .gte("created_at", since);

  if (countError) {
    return err({ code: "DB_ERROR", message: countError.message });
  }
  if ((count ?? 0) >= REQUEST_HOURLY_LIMIT) {
    return err({
      code: "RATE_LIMIT",
      message: "This workspace has received too many requests in the past hour. Try again later.",
    });
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
