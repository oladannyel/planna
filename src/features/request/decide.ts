import { revalidatePath } from "next/cache";

import { createTask } from "@/features/tasks/actions";
import { parseTaskFromText } from "@/features/tasks/parser";
import type { TaskInput } from "@/features/tasks/types";
import { getAuthedContext } from "@/features/workspace/queries";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { createAdminClient } from "@/lib/supabase/admin";

import { publicOrigin } from "./link";
import { REQUEST_COLUMNS, rowToRequest } from "./mappers";
import { notifyRequester } from "./notify";
import { requestOwnerForWorkspace } from "./owner";
import type { WorkRequest } from "./types";

/** Pages that show the inbox or its count. */
function revalidateRequestViews(): void {
  revalidatePath("/requests");
  revalidatePath("/board");
}

/**
 * Load one request **through the caller's own session**, not the service
 * role.
 *
 * This is the authorisation check and there is no second one: RLS scopes
 * `requests` to the workspaces the signed-in user owns (migration 0008), so
 * another owner's request id simply does not exist here. Reading with the
 * admin client and comparing workspace ids in TypeScript would work until
 * someone forgot the comparison.
 */
async function loadOwnRequest(requestId: string) {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.value.supabase
    .from("requests")
    .select(REQUEST_COLUMNS)
    .eq("workspace_id", ctx.value.workspaceId)
    .eq("id", requestId)
    .maybeSingle();

  if (error) return err({ code: "DB_ERROR" as const, message: error.message });
  if (!data) return err({ code: "NOT_FOUND" as const, message: "Request not found" });

  return ok({ ctx: ctx.value, request: rowToRequest(data) });
}

/** Queue the requester's mail for a decision. Never fails the decision. */
async function announce(
  request: WorkRequest,
  event: Parameters<typeof notifyRequester>[1],
): Promise<void> {
  const admin = createAdminClient();
  const owner = await requestOwnerForWorkspace(request.workspaceId);
  await notifyRequester({ admin, request, owner, origin: await publicOrigin() }, event);
}

export interface AcceptedRequest {
  requestId: string;
  taskId: string;
}

/**
 * Accept a request: parse it, put it on the board, tell the requester.
 *
 * This is where the model call lives now (ADR 0001). The text being parsed is
 * a stranger's, so the parse is allowed to fail: a failure falls back to the
 * submitted title, urgency and deadline rather than refusing the accept. The
 * owner has already decided to do this work; a model outage is not a reason
 * to make them re-type it.
 *
 * Idempotent. A second accept — a double-click, a retried action — returns
 * the task the first one created instead of creating another.
 */
export async function acceptRequest(requestId: string): Promise<Result<AcceptedRequest>> {
  const loaded = await loadOwnRequest(requestId);
  if (!loaded.ok) return loaded;

  const { ctx, request } = loaded.value;

  if (request.state === "accepted" && request.taskId) {
    return ok({ requestId: request.id, taskId: request.taskId });
  }
  if (request.state === "rejected") {
    return err({ code: "VALIDATION_ERROR", message: "This request was already declined." });
  }

  const rawText = `${request.title}. ${request.description}. Priority: ${request.urgency}.${
    request.desiredDeadline ? ` Deadline: ${request.desiredDeadline}` : ""
  }`;
  const parseResult = await parseTaskFromText(rawText);
  const parsed = parseResult.ok ? parseResult.value : null;

  const dueDate = parsed?.dueDate ?? request.desiredDeadline ?? undefined;
  const input: TaskInput = {
    title: parsed?.title ?? request.title,
    description: request.description,
    priority: parsed?.priority ?? request.urgency,
    tags: parsed?.tags ?? [],
    ...(dueDate ? { dueDate } : {}),
    ...(parsed?.estimatedMinutes ? { estimatedMinutes: parsed.estimatedMinutes } : {}),
  };

  const created = await createTask(input, "request_link", { requestedBy: request.requesterName });
  if (!created.ok) return created;

  const { error } = await ctx.supabase
    .from("requests")
    .update({
      state: "accepted",
      task_id: created.value.id,
      decided_at: new Date().toISOString(),
    })
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", request.id);

  if (error) {
    // The task exists but the link does not, so a retry would create a second
    // one. Say so loudly rather than reporting success.
    return err({ code: "DB_ERROR", message: error.message });
  }

  await announce({ ...request, state: "accepted", taskId: created.value.id }, { kind: "accepted" });
  revalidateRequestViews();

  return ok({ requestId: request.id, taskId: created.value.id });
}

/**
 * Decline a request. No task is created, now or later: the state is terminal,
 * so a decline cannot be undone by a second click on accept.
 */
export async function rejectRequest(
  requestId: string,
  reason?: string,
): Promise<Result<{ requestId: string }>> {
  const loaded = await loadOwnRequest(requestId);
  if (!loaded.ok) return loaded;

  const { ctx, request } = loaded.value;

  if (request.state === "rejected") {
    return ok({ requestId: request.id });
  }
  if (request.state === "accepted") {
    return err({
      code: "VALIDATION_ERROR",
      message: "This request was already accepted. Cancel the task instead.",
    });
  }

  const trimmed = reason?.trim().slice(0, 1000);

  const { error } = await ctx.supabase
    .from("requests")
    .update({
      state: "rejected",
      decline_reason: trimmed ? trimmed : null,
      decided_at: new Date().toISOString(),
    })
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", request.id);

  if (error) return err({ code: "DB_ERROR", message: error.message });

  await announce({ ...request, state: "rejected" }, { kind: "rejected", reason: trimmed ?? null });
  revalidateRequestViews();

  return ok({ requestId: request.id });
}
