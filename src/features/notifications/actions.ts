"use server";

import { revalidatePath } from "next/cache";

import { getAuthedContext } from "@/features/workspace/queries";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";

/**
 * Mark bell items read.
 *
 * Scoped to the caller's workspace in the statement itself, not only by RLS:
 * belt and braces on a write that takes an id list straight from the client.
 */
export async function markNotificationsRead(ids?: string[]): Promise<Result<{ updated: number }>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  let query = ctx.value.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() }, { count: "exact" })
    .eq("workspace_id", ctx.value.workspaceId)
    .is("read_at", null);

  if (ids && ids.length > 0) {
    query = query.in("id", ids.slice(0, 100));
  }

  const { error, count } = await query;
  if (error) return err({ code: "DB_ERROR", message: error.message });

  revalidatePath("/", "layout");
  return ok({ updated: count ?? 0 });
}
