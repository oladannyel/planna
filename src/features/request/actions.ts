"use server";

import { requestInputSchema } from "@/features/tasks/schema";
import { err } from "@/lib/result";
import type { Result } from "@/lib/result";

import { ingestRequest } from "./ingest";

/** Public server action backing the request form. Validates then ingests. */
export async function submitRequest(input: unknown): Promise<Result<{ taskId: string }>> {
  const validated = requestInputSchema.safeParse(input);
  if (!validated.success) {
    return err({
      code: "VALIDATION_ERROR",
      message: "Invalid request",
      fields: validated.error.flatten().fieldErrors,
    });
  }
  return ingestRequest(validated.data);
}
