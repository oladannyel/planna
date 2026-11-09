import { parseTaskFromText } from "@/features/tasks/parser";
import type { RequestInputSchema } from "@/features/tasks/schema";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

import { addressKey, claimSlot, REQUEST_HOURLY_LIMIT, REQUEST_IP_HOURLY_LIMIT } from "./throttle";

export { REQUEST_HOURLY_LIMIT, REQUEST_IP_HOURLY_LIMIT };

const RATE_LIMITED = {
  code: "RATE_LIMIT",
  message: "Too many requests in the past hour. Try again later.",
} as const;

export interface IngestContext {
  /**
   * Client address, from `clientAddress(headers)`. Null when the request
   * arrived without a usable one; all such callers then share a single bucket,
   * so stripping the header costs an attacker more than it buys.
   */
  address: string | null;
}

/**
 * Core request-link ingestion: throttle the caller, resolve the workspace by
 * slug (service role), throttle the workspace, AI-enrich the submission, and
 * insert a `request_link` task. Shared by the public API route and the
 * `submitRequest` server action.
 *
 * The order of the first three steps is the security design, not an accident:
 *
 *  1. **Address slot, before the slug is touched.** An unknown slug used to be
 *     answered before anything was counted, so the 404 was a free existence
 *     oracle over every workspace in the deployment. Counting first means slug
 *     guessing costs a guess from a quota of ten an hour.
 *  2. **Workspace slot, before the model call.** Rejecting a submission only
 *     after it has been parsed would still let an attacker burn the owner's AI
 *     quota at will, which is the expensive half of the attack.
 *  3. **Then, and only then, the model call and the insert.**
 *
 * Both claims are atomic (see `claim_request_slot`, migration 0007). The
 * earlier implementation counted rows and then inserted, which held against a
 * sequential caller and not against a concurrent one.
 */
export async function ingestRequest(
  input: RequestInputSchema,
  context: IngestContext,
): Promise<Result<{ taskId: string }>> {
  const admin = createAdminClient();

  // `anon` rather than a digest when no address is available: a fixed literal
  // puts every such caller in one bucket, which is the conservative reading.
  const addressBucket = context.address ? `ip:${addressKey(context.address)}` : "ip:unknown";

  const addressSlot = await claimSlot(admin, addressBucket, REQUEST_IP_HOURLY_LIMIT);
  if (!addressSlot.ok) return addressSlot;
  if (!addressSlot.value.allowed) return err(RATE_LIMITED);

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

  const workspaceSlot = await claimSlot(admin, `ws:${workspace.id}`, REQUEST_HOURLY_LIMIT);
  if (!workspaceSlot.ok) return workspaceSlot;
  if (!workspaceSlot.value.allowed) {
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
