"use server";

import { headers } from "next/headers";

import { requestInputSchema } from "@/features/tasks/schema";
import { err } from "@/lib/result";
import type { Result } from "@/lib/result";

import { acceptRequest as acceptRequestCore, rejectRequest as rejectRequestCore } from "./decide";
import { ingestRequest } from "./ingest";
import type { IngestResult } from "./ingest";
import { publicOrigin } from "./link";
import { clientAddress } from "./throttle";

/**
 * Public server action backing the request form. Validates then ingests.
 *
 * The client address comes from the request headers here rather than from an
 * argument: a server action's arguments are supplied by the browser, so an
 * address passed in by the caller is an address the caller chose.
 */
export async function submitRequest(input: unknown): Promise<Result<IngestResult>> {
  const validated = requestInputSchema.safeParse(input);
  if (!validated.success) {
    return err({
      code: "VALIDATION_ERROR",
      message: "Invalid request",
      fields: validated.error.flatten().fieldErrors,
    });
  }

  return ingestRequest(validated.data, {
    address: clientAddress(await headers()),
    origin: await publicOrigin(),
  });
}

/**
 * Accept a request — owner only; the authorisation is RLS inside
 * `acceptRequest`. Re-exported through this "use server" module so a client
 * component can call it; the logic lives in `decide.ts` so it can be tested
 * without a server-action harness.
 */
export async function acceptRequest(
  requestId: string,
): Promise<Result<{ requestId: string; taskId: string }>> {
  if (typeof requestId !== "string" || requestId.length === 0) {
    return err({ code: "VALIDATION_ERROR", message: "Invalid request id" });
  }
  return acceptRequestCore(requestId);
}

/** Decline a request, with an optional reason the requester will be sent. */
export async function rejectRequest(
  requestId: string,
  reason?: string,
): Promise<Result<{ requestId: string }>> {
  if (typeof requestId !== "string" || requestId.length === 0) {
    return err({ code: "VALIDATION_ERROR", message: "Invalid request id" });
  }
  return rejectRequestCore(requestId, typeof reason === "string" ? reason : undefined);
}
