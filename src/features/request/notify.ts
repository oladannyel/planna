import { enqueueEmail } from "@/features/notifications/outbox";
import type { RequestSummary } from "@/features/notifications/templates";
import {
  ownerNewRequest,
  requesterAccepted,
  requesterProgress,
  requesterReceived,
  requesterRejected,
} from "@/features/notifications/templates";
import { truncate } from "@/features/notifications/templates";
import { logger } from "@/lib/logger";
import type { createAdminClient } from "@/lib/supabase/admin";

import { requestStatusLinkFor } from "./link";
import type { RequestOwner } from "./owner";
import type { WorkRequest } from "./types";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface NotifyContext {
  admin: AdminClient;
  request: WorkRequest;
  owner: RequestOwner | null;
  /** Absolute origin, so links in mail point at the host in use. */
  origin: string;
}

function summaryOf(request: WorkRequest, owner: RequestOwner | null): RequestSummary {
  return {
    requesterName: request.requesterName,
    title: request.title,
    description: request.description,
    urgency: request.urgency,
    ownerName: owner?.name ?? null,
  };
}

/**
 * Tell the owner a request arrived: a bell item, and an email.
 *
 * Both are best effort. A request that was saved but could not be announced
 * is still a request, and failing the submission because the owner's mail
 * provider is down would tell the colleague their request did not go through
 * when it did.
 */
export async function notifyOwner({ admin, request, owner, origin }: NotifyContext): Promise<void> {
  const { error } = await admin.from("notifications").insert({
    workspace_id: request.workspaceId,
    kind: "request_received",
    title: `New request from ${request.requesterName}`,
    body: truncate(request.title, 160),
    request_id: request.id,
  });

  if (error) {
    logger.warn("Could not write request notification", {
      requestId: request.id,
      reason: error.message,
    });
  }

  if (!owner?.email) return;

  const mail = ownerNewRequest(summaryOf(request, owner), `${origin}/requests`);
  const queued = await enqueueEmail(admin, {
    to: owner.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    workspaceId: request.workspaceId,
    requestId: request.id,
  });
  if (!queued.ok) {
    logger.warn("Could not queue owner email", { requestId: request.id, reason: queued.error });
  }
}

type RequesterEvent =
  | { kind: "received" }
  | { kind: "accepted" }
  | { kind: "rejected"; reason?: string | null }
  | { kind: "progress"; status: string };

/**
 * Tell the requester where their request stands.
 *
 * A request with no email address is a no-op, not a failure: the address is
 * optional, and the status page carries the same information for anyone who
 * kept their link.
 */
export async function notifyRequester(
  { admin, request, owner, origin }: NotifyContext,
  event: RequesterEvent,
): Promise<void> {
  if (!request.requesterEmail) return;

  const statusUrl = requestStatusLinkFor(origin, request.token);
  const summary = summaryOf(request, owner);

  const mail = (() => {
    switch (event.kind) {
      case "received":
        return requesterReceived(summary, statusUrl);
      case "accepted":
        return requesterAccepted(summary, statusUrl);
      case "rejected":
        return requesterRejected(summary, statusUrl, event.reason ?? null);
      case "progress":
        return requesterProgress(summary, event.status, statusUrl);
    }
  })();

  if (!mail) return;

  const queued = await enqueueEmail(admin, {
    to: request.requesterEmail,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    workspaceId: request.workspaceId,
    requestId: request.id,
  });

  if (!queued.ok) {
    logger.warn("Could not queue requester email", {
      requestId: request.id,
      event: event.kind,
      reason: queued.error,
    });
  }
}
