import { getAuthedContext } from "@/features/workspace/queries";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { seal } from "@/lib/sealed";
import { createAdminClient } from "@/lib/supabase/admin";

export interface EmailConnection {
  emailAddress: string;
  query: string;
  state: "active" | "revoked" | "error";
  lastError: string | null;
  lastPolledAt: string | null;
  lastTaskAt: string | null;
}

/**
 * The connection for the signed-in owner, if any.
 *
 * The columns are named one by one and `refresh_token` is not among them.
 * RLS is row-level, so the owner's own policy would happily return their
 * sealed token to a server component that then passed it to the client; not
 * selecting it is what keeps that from being one careless prop away.
 */
export async function getEmailConnection(): Promise<Result<EmailConnection | null>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.value.supabase
    .from("email_connections")
    .select("email_address, query, state, last_error, last_polled_at, last_task_at")
    .eq("workspace_id", ctx.value.workspaceId)
    .maybeSingle();

  if (error) return err({ code: "DB_ERROR", message: error.message });
  if (!data) return ok(null);

  return ok({
    emailAddress: data.email_address,
    query: data.query,
    state: data.state,
    lastError: data.last_error,
    lastPolledAt: data.last_polled_at,
    lastTaskAt: data.last_task_at,
  });
}

/**
 * Save a freshly granted mailbox, sealing the refresh token.
 *
 * Service role, because the callback writes a column the owner's own policy
 * can reach but no client path should: upserting by workspace id means a
 * re-connect replaces the grant rather than leaving an orphan.
 */
export async function storeConnection(args: {
  workspaceId: string;
  emailAddress: string;
  refreshToken: string;
}): Promise<Result<null>> {
  const admin = createAdminClient();

  const { error } = await admin.from("email_connections").upsert(
    {
      workspace_id: args.workspaceId,
      provider: "gmail",
      email_address: args.emailAddress,
      refresh_token: seal(args.refreshToken),
      state: "active",
      last_error: null,
    },
    { onConflict: "workspace_id" },
  );

  if (error) return err({ code: "DB_ERROR", message: error.message });
  return ok(null);
}
