import { sendEmail } from "@/lib/email/transport";
import { logger } from "@/lib/logger";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Give up after this many tries; the row stays as `failed` evidence. */
export const MAX_SEND_ATTEMPTS = 5;

/** How many pending rows one drain pass will take. */
export const DRAIN_BATCH = 25;

export interface QueuedEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  workspaceId?: string | null;
  requestId?: string | null;
}

/**
 * Queue an email and try to send it now.
 *
 * The row is written **before** the send, not after it. Sending first and
 * recording afterwards loses the mail on any crash between the two, and the
 * failure mode of this feature is silence — the requester never learns that
 * their request was rejected, and nothing anywhere says so. With the row
 * first, the worst case is a duplicate, which is the direction to fail in.
 *
 * The send result is folded back into the same row: `sent`, or `pending` with
 * the attempt counted, or `failed` when the provider's answer will not change.
 */
export async function enqueueEmail(
  admin: AdminClient,
  message: QueuedEmail,
): Promise<Result<{ id: string; delivered: boolean }>> {
  const { data, error } = await admin
    .from("email_outbox")
    .insert({
      workspace_id: message.workspaceId ?? null,
      request_id: message.requestId ?? null,
      to_email: message.to,
      subject: message.subject,
      body_text: message.text,
      body_html: message.html ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  const delivered = await attemptSend(admin, {
    id: data.id,
    to_email: message.to,
    subject: message.subject,
    body_text: message.text,
    body_html: message.html ?? null,
    attempts: 0,
  });

  return ok({ id: data.id, delivered });
}

export interface OutboxRow {
  id: string;
  to_email: string;
  subject: string;
  body_text: string;
  body_html: string | null;
  attempts: number;
}

/**
 * Send one outbox row and record what happened. Never throws: a notification
 * that cannot be delivered must not take down the action that produced it —
 * accepting a request succeeds whether or not the mail about it does.
 */
export async function attemptSend(admin: AdminClient, row: OutboxRow): Promise<boolean> {
  const attempts = row.attempts + 1;
  const result = await sendEmail({
    to: row.to_email,
    subject: row.subject,
    text: row.body_text,
    ...(row.body_html ? { html: row.body_html } : {}),
  });

  if (result.ok) {
    await admin
      .from("email_outbox")
      .update({ state: "sent", attempts, sent_at: new Date().toISOString(), last_error: null })
      .eq("id", row.id);
    return true;
  }

  const exhausted = attempts >= MAX_SEND_ATTEMPTS;
  const state = result.error.retryable && !exhausted ? "pending" : "failed";

  await admin
    .from("email_outbox")
    .update({ state, attempts, last_error: result.error.message.slice(0, 500) })
    .eq("id", row.id);

  logger.warn("Outbound email not delivered", {
    outboxId: row.id,
    attempts,
    state,
    reason: result.error.message,
  });
  return false;
}

/**
 * Retry the pending backlog, oldest first. Called by the daily cron.
 *
 * Bounded by `DRAIN_BATCH` so a long backlog cannot run the cron past its
 * timeout, and sequential rather than parallel so a rate-limited provider is
 * not hit with twenty-five simultaneous requests it will refuse.
 */
export async function drainOutbox(
  limit: number = DRAIN_BATCH,
): Promise<Result<{ attempted: number; sent: number }>> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("email_outbox")
    .select("id, to_email, subject, body_text, body_html, attempts")
    .eq("state", "pending")
    .lt("attempts", MAX_SEND_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  let sent = 0;
  for (const row of data ?? []) {
    if (await attemptSend(admin, row)) sent += 1;
  }

  return ok({ attempted: data?.length ?? 0, sent });
}
