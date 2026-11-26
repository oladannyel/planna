import { randomBytes } from "node:crypto";

import type { RequestInputSchema } from "@/features/tasks/schema";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { createAdminClient } from "@/lib/supabase/admin";

import { requestStatusLinkFor } from "./link";
import { REQUEST_COLUMNS, rowToRequest } from "./mappers";
import { notifyOwner, notifyRequester } from "./notify";
import { requestOwnerForSlug } from "./owner";
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
  /** Absolute origin for the links in outbound mail. */
  origin: string;
}

export interface IngestResult {
  requestId: string;
  /** Where the requester follows this one request. Safe to show them. */
  statusUrl: string;
}

/** 128 bits. The status page is addressed by this and nothing else. */
function mintToken(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Core request-link ingestion: throttle the caller, resolve the workspace by
 * slug (service role), throttle the workspace, and record a **pending
 * request**. Shared by the public API route and the `submitRequest` server
 * action.
 *
 * The order of the first three steps is the security design, not an accident:
 *
 *  1. **Address slot, before the slug is touched.** An unknown slug used to be
 *     answered before anything was counted, so the 404 was a free existence
 *     oracle over every workspace in the deployment. Counting first means slug
 *     guessing costs a guess from a quota of ten an hour.
 *  2. **Workspace slot, before anything is written.** Rejecting a submission
 *     only after the work has been done still lets an attacker spend the
 *     owner's resources at will.
 *  3. **Then, and only then, the insert and the notifications.**
 *
 * Both claims are atomic (see `claim_request_slot`, migration 0007).
 *
 * What this function deliberately no longer does is **call the model**. A
 * submission used to be parsed and inserted as a task before any human had
 * seen it, which put the expensive, rate-limited dependency in front of an
 * unauthenticated endpoint and put strangers' text straight onto the owner's
 * board. Parsing now happens on accept (ADR 0001), behind authentication.
 */
export async function ingestRequest(
  input: RequestInputSchema,
  context: IngestContext,
): Promise<Result<IngestResult>> {
  const admin = createAdminClient();

  // `unknown` rather than a digest when no address is available: a fixed
  // literal puts every such caller in one bucket, the conservative reading.
  const addressBucket = context.address ? `ip:${addressKey(context.address)}` : "ip:unknown";

  const addressSlot = await claimSlot(admin, addressBucket, REQUEST_IP_HOURLY_LIMIT);
  if (!addressSlot.ok) return addressSlot;
  if (!addressSlot.value.allowed) return err(RATE_LIMITED);

  const owner = await requestOwnerForSlug(input.slug);
  if (!owner) {
    return err({ code: "NOT_FOUND", message: "Workspace not found" });
  }

  const workspaceSlot = await claimSlot(admin, `ws:${owner.workspaceId}`, REQUEST_HOURLY_LIMIT);
  if (!workspaceSlot.ok) return workspaceSlot;
  if (!workspaceSlot.value.allowed) {
    return err({
      code: "RATE_LIMIT",
      message: "This workspace has received too many requests in the past hour. Try again later.",
    });
  }

  const { data, error } = await admin
    .from("requests")
    .insert({
      workspace_id: owner.workspaceId,
      requester_name: input.requesterName,
      requester_email: input.requesterEmail ?? null,
      title: input.title,
      description: input.description,
      urgency: input.urgency,
      desired_deadline: input.desiredDeadline ?? null,
      token: mintToken(),
    })
    .select(REQUEST_COLUMNS)
    .single();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  const request = rowToRequest(data);
  const notifyContext = { admin, request, owner, origin: context.origin };

  // Neither of these can fail the submission — see `notifyOwner`.
  await notifyOwner(notifyContext);
  await notifyRequester(notifyContext, { kind: "received" });

  return ok({
    requestId: request.id,
    statusUrl: requestStatusLinkFor(context.origin, request.token),
  });
}
