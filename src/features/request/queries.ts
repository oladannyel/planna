import { getAuthedContext } from "@/features/workspace/queries";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { createAdminClient } from "@/lib/supabase/admin";

import { REQUEST_COLUMNS, rowToRequest } from "./mappers";
import { requestOwnerForWorkspace } from "./owner";
import type { RequestStatusView, WorkRequest } from "./types";

/** Everything in the owner's inbox, pending first, newest first within that. */
export async function listRequests(): Promise<Result<WorkRequest[]>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.value.supabase
    .from("requests")
    .select(REQUEST_COLUMNS)
    .eq("workspace_id", ctx.value.workspaceId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return err({ code: "DB_ERROR", message: error.message });

  const rows = (data ?? []).map(rowToRequest);
  // Pending first: the inbox is a queue of decisions, and a decided request
  // is history. Sorted here rather than in SQL because "pending before the
  // rest" is not an ordering Postgres can express on the enum without a CASE,
  // and the page reads at most 200 rows.
  return ok([
    ...rows.filter((r) => r.state === "pending"),
    ...rows.filter((r) => r.state !== "pending"),
  ]);
}

/** How many decisions are waiting. Drives the sidebar and bell badges. */
export async function pendingRequestCount(): Promise<number> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return 0;

  const { count, error } = await ctx.value.supabase
    .from("requests")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ctx.value.workspaceId)
    .eq("state", "pending");

  return error ? 0 : (count ?? 0);
}

/**
 * The public status view for one token.
 *
 * Service role, because the reader has no account — the token *is* the
 * authorisation. Only this request's own fields are returned, and notably not
 * the requester's email address, the owner's address, or the workspace id: a
 * forwarded link should reveal no more than the person who filed the request
 * already knew.
 */
export async function requestStatusByToken(token: string): Promise<RequestStatusView | null> {
  // Cheap shape check before touching the database. The token is 32 hex
  // characters; anything else is a typo or a probe.
  if (!/^[0-9a-f]{32}$/.test(token)) return null;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("requests")
    .select(REQUEST_COLUMNS)
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;

  const request = rowToRequest(data);
  const owner = await requestOwnerForWorkspace(request.workspaceId);

  let taskStatus: RequestStatusView["taskStatus"] = null;
  let completedAt: string | null = null;

  if (request.taskId) {
    const { data: task } = await admin
      .from("tasks")
      .select("status, completed_at")
      .eq("id", request.taskId)
      .maybeSingle();
    taskStatus = task?.status ?? null;
    completedAt = task?.completed_at ?? null;
  }

  return {
    title: request.title,
    description: request.description,
    requesterName: request.requesterName,
    urgency: request.urgency,
    state: request.state,
    declineReason: request.declineReason,
    createdAt: request.createdAt,
    decidedAt: request.decidedAt,
    ownerName: owner?.name ?? null,
    taskStatus,
    completedAt,
  };
}

export interface InboxRequest extends WorkRequest {
  /** The status of the task an accept created, or null when there is none. */
  taskStatus: "todo" | "in_progress" | "done" | "cancelled" | null;
}

/**
 * The inbox, with each accepted request's current task status attached.
 *
 * Two queries rather than a join: PostgREST can embed `tasks` through the
 * foreign key, but the embed comes back shaped as a nested object that the
 * generated types describe loosely, and the second query is one indexed `in`
 * over at most a couple of hundred ids.
 */
export async function listInboxRequests(): Promise<Result<InboxRequest[]>> {
  const requests = await listRequests();
  if (!requests.ok) return requests;

  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const taskIds = requests.value
    .map((request) => request.taskId)
    .filter((id): id is string => id !== null);

  const statuses = new Map<string, "todo" | "in_progress" | "done" | "cancelled">();

  if (taskIds.length > 0) {
    const { data } = await ctx.value.supabase
      .from("tasks")
      .select("id, status")
      .eq("workspace_id", ctx.value.workspaceId)
      .in("id", taskIds);

    for (const row of data ?? []) statuses.set(row.id, row.status);
  }

  return ok(
    requests.value.map((request) => ({
      ...request,
      taskStatus: request.taskId ? (statuses.get(request.taskId) ?? null) : null,
    })),
  );
}
