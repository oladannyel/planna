"use server";

import { headers } from "next/headers";

import { requestInputSchema } from "@/features/tasks/schema";
import { err } from "@/lib/result";
import type { Result } from "@/lib/result";

import { ingestRequest } from "./ingest";
import { clientAddress } from "./throttle";

/**
 * Public server action backing the request form. Validates then ingests.
 *
 * The client address comes from the request headers here rather than from an
 * argument: a server action's arguments are supplied by the browser, so an
 * address passed in by the caller is an address the caller chose.
 */
export async function submitRequest(input: unknown): Promise<Result<{ taskId: string }>> {
  const validated = requestInputSchema.safeParse(input);
  if (!validated.success) {
    return err({
      code: "VALIDATION_ERROR",
      message: "Invalid request",
      fields: validated.error.flatten().fieldErrors,
    });
  }

  return ingestRequest(validated.data, { address: clientAddress(await headers()) });
}
