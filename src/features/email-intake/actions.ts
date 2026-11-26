"use server";

import { revalidatePath } from "next/cache";

import { getAuthedContext } from "@/features/workspace/queries";
import { logger } from "@/lib/logger";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { open } from "@/lib/sealed";
import { createAdminClient } from "@/lib/supabase/admin";

import { revokeToken } from "./oauth";

/** The Gmail search a poll runs. Short, and the owner's to set. */
const MAX_QUERY_LENGTH = 200;

/**
 * Disconnect the mailbox: revoke the grant at Google, then delete the row.
 *
 * Revoking first. If the delete succeeded and the revoke then failed, the app
 * would show "not connected" while a live grant sat on the owner's Google
 * account with nothing here able to show or withdraw it. A failed revoke is
 * logged and the row is still deleted — we must not hold a token the owner
 * has asked us to drop — and the settings page says to check Google.
 */
export async function disconnectEmail(): Promise<Result<{ revoked: boolean }>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();

  const { data } = await admin
    .from("email_connections")
    .select("refresh_token")
    .eq("workspace_id", ctx.value.workspaceId)
    .maybeSingle();

  let revoked = false;
  if (data?.refresh_token) {
    try {
      const result = await revokeToken(open(data.refresh_token));
      revoked = result.ok;
      if (!result.ok) {
        logger.warn("Google refused the revoke", { reason: result.error.message });
      }
    } catch (cause) {
      logger.warn("Could not open the stored token to revoke it", { cause });
    }
  }

  const { error } = await admin
    .from("email_connections")
    .delete()
    .eq("workspace_id", ctx.value.workspaceId);

  if (error) return err({ code: "DB_ERROR", message: error.message });

  revalidatePath("/settings/email");
  return ok({ revoked });
}

/** Change which messages count as tasks. */
export async function updateEmailQuery(query: string): Promise<Result<{ query: string }>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const trimmed = typeof query === "string" ? query.trim() : "";
  if (trimmed.length === 0 || trimmed.length > MAX_QUERY_LENGTH) {
    return err({
      code: "VALIDATION_ERROR",
      message: `A search is required, and must be ${MAX_QUERY_LENGTH} characters or fewer.`,
    });
  }

  const { error } = await ctx.value.supabase
    .from("email_connections")
    .update({ query: trimmed })
    .eq("workspace_id", ctx.value.workspaceId);

  if (error) return err({ code: "DB_ERROR", message: error.message });

  revalidatePath("/settings/email");
  return ok({ query: trimmed });
}
