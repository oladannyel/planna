import { parseTaskFromText } from "@/features/tasks/parser";
import { logger } from "@/lib/logger";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { open } from "@/lib/sealed";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

import { getMessage, labelFromQuery, labelIdByName, listMessageIds, markHandled } from "./gmail";
import { refreshAccessToken } from "./oauth";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Messages taken in one pass. Bounded so the cron cannot run long. */
export const POLL_BATCH = 20;

const DEFAULT_DEADLINE_MS = 24 * 60 * 60 * 1000;

export interface PollSummary {
  workspaceId: string;
  scanned: number;
  created: number;
  skipped: number;
}

/**
 * The text handed to the parser.
 *
 * Subject first, because it is the one line the sender wrote as a summary,
 * and then the body, truncated. A forwarded thread can be tens of kilobytes
 * of quoted history; the model is a free tier and the task is in the first
 * paragraph.
 */
export function messageToPrompt(subject: string, body: string): string {
  const trimmedBody = body.length > 2000 ? `${body.slice(0, 2000)}…` : body;
  return [subject, trimmedBody].filter((part) => part.trim().length > 0).join("\n\n");
}

interface ConnectionRow {
  workspace_id: string;
  refresh_token: string;
  query: string;
}

/**
 * Poll one connected mailbox and turn each new message into a task.
 *
 * Idempotency is the `email_ingest_log` row, not the label: the label removal
 * is a second API call that can fail after the task has been created, and a
 * poll that re-read the message would then make a duplicate. The log is
 * written in the same step as the task, keyed `(workspace_id, message_id)`,
 * and a conflict there means "already done".
 */
export async function pollConnection(
  admin: AdminClient,
  connection: ConnectionRow,
): Promise<Result<PollSummary>> {
  let refreshToken: string;
  try {
    refreshToken = open(connection.refresh_token);
  } catch (cause) {
    await markConnectionError(
      admin,
      connection.workspace_id,
      `Stored token unreadable: ${String(cause)}`,
    );
    return err({ code: "UNAUTHORIZED", message: "Stored refresh token could not be opened" });
  }

  const access = await refreshAccessToken(refreshToken);
  if (!access.ok) {
    // A refused refresh token means the owner revoked access at Google, or
    // the grant expired. Marking it rather than retrying forever is what puts
    // "reconnect" in front of them on the settings page.
    await markConnectionError(admin, connection.workspace_id, access.error.message);
    return access;
  }

  const accessToken = access.value;

  const ids = await listMessageIds(accessToken, connection.query, POLL_BATCH);
  if (!ids.ok) {
    await markConnectionError(admin, connection.workspace_id, ids.error.message);
    return ids;
  }

  // Resolved once per poll, not per message.
  const labelName = labelFromQuery(connection.query);
  let labelIds: string[] = [];
  if (labelName) {
    const resolved = await labelIdByName(accessToken, labelName);
    if (resolved.ok && resolved.value) labelIds = [resolved.value];
  }

  let created = 0;
  let skipped = 0;

  for (const messageId of ids.value) {
    const outcome = await ingestMessage(admin, {
      workspaceId: connection.workspace_id,
      accessToken,
      messageId,
      labelIds,
    });
    if (outcome === "created") created += 1;
    else skipped += 1;
  }

  await admin
    .from("email_connections")
    .update({
      state: "active",
      last_error: null,
      last_polled_at: new Date().toISOString(),
      ...(created > 0 ? { last_task_at: new Date().toISOString() } : {}),
    })
    .eq("workspace_id", connection.workspace_id);

  return ok({
    workspaceId: connection.workspace_id,
    scanned: ids.value.length,
    created,
    skipped,
  });
}

async function markConnectionError(
  admin: AdminClient,
  workspaceId: string,
  message: string,
): Promise<void> {
  await admin
    .from("email_connections")
    .update({
      state: "error",
      last_error: message.slice(0, 500),
      last_polled_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId);
}

async function ingestMessage(
  admin: AdminClient,
  args: { workspaceId: string; accessToken: string; messageId: string; labelIds: string[] },
): Promise<"created" | "skipped"> {
  const { workspaceId, accessToken, messageId, labelIds } = args;

  const { data: seen } = await admin
    .from("email_ingest_log")
    .select("message_id")
    .eq("workspace_id", workspaceId)
    .eq("message_id", messageId)
    .maybeSingle();

  if (seen) {
    // Already a task. The label removal evidently failed last time, so try it
    // again — otherwise this message is scanned on every poll forever.
    if (labelIds.length > 0) await markHandled(accessToken, messageId, labelIds);
    return "skipped";
  }

  const message = await getMessage(accessToken, messageId);
  if (!message.ok) {
    logger.warn("Could not read a message", { messageId, reason: message.error.message });
    return "skipped";
  }

  const prompt = messageToPrompt(message.value.subject, message.value.body);
  if (prompt.trim().length === 0) return "skipped";

  const parsed = await parseTaskFromText(prompt);
  const fields = parsed.ok ? parsed.value : null;

  const dueAt = fields?.dueDate
    ? `${fields.dueDate}T23:59:59.999Z`
    : new Date(Date.now() + DEFAULT_DEADLINE_MS).toISOString();

  const { data: task, error } = await admin
    .from("tasks")
    .insert({
      workspace_id: workspaceId,
      // The subject is the fallback title: an email with no parse is still a
      // task someone sent on purpose, and dropping it would be the worse bug.
      title: fields?.title ?? message.value.subject ?? "Task from email",
      description: message.value.body.slice(0, 5000),
      priority: fields?.priority ?? "medium",
      tags: fields?.tags ?? [],
      due_at: dueAt,
      due_date: dueAt.slice(0, 10),
      estimated_minutes: fields?.estimatedMinutes ?? null,
      source: "email",
      requested_by: message.value.from || null,
      status_history: [{ status: "todo", changedAt: new Date().toISOString() }] as Json[],
    })
    .select("id")
    .single();

  if (error || !task) {
    logger.error("Could not create a task from an email", {
      messageId,
      reason: error?.message,
    });
    return "skipped";
  }

  const { error: logError } = await admin
    .from("email_ingest_log")
    .insert({ workspace_id: workspaceId, message_id: messageId, task_id: task.id });

  if (logError) {
    // The task exists and the log does not, so the next poll would make a
    // second one. Loud, because the fix is manual.
    logger.error("Email ingested but not logged — duplicate risk", {
      messageId,
      taskId: task.id,
      reason: logError.message,
    });
  }

  if (labelIds.length > 0) await markHandled(accessToken, messageId, labelIds);

  return "created";
}

/** Poll every active connection. Called by the cron. */
export async function pollAllMailboxes(): Promise<Result<PollSummary[]>> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("email_connections")
    .select("workspace_id, refresh_token, query")
    .eq("state", "active");

  if (error) return err({ code: "DB_ERROR", message: error.message });

  const summaries: PollSummary[] = [];
  for (const connection of data ?? []) {
    const result = await pollConnection(admin, connection);
    if (result.ok) summaries.push(result.value);
    else {
      logger.warn("Mailbox poll failed", {
        workspaceId: connection.workspace_id,
        reason: result.error.message,
      });
    }
  }

  return ok(summaries);
}
