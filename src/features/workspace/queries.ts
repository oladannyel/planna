import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ServerSupabaseClient = ReturnType<typeof createServerSupabaseClient>;

export interface AuthedContext {
  supabase: ServerSupabaseClient;
  userId: string;
  workspaceId: string;
}

/**
 * Resolve the authenticated user and their workspace in one step. Every task
 * query/action funnels through here so auth + workspace scoping is consistent.
 */
export async function getAuthedContext(): Promise<Result<AuthedContext>> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message, cause: error });
  }

  if (!workspace) {
    return err({ code: "NOT_FOUND", message: "Workspace not found" });
  }

  return ok({ supabase, userId: user.id, workspaceId: workspace.id });
}
