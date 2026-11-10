import { requestMemo } from "@/lib/request-memo";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export interface AuthedContext {
  supabase: ServerSupabaseClient;
  userId: string;
  workspaceId: string;
  /** The workspace's public slug — the shareable request link is built from it. */
  workspaceSlug: string;
}

/**
 * Resolve the authenticated user and their workspace in one step. Every task
 * query/action funnels through here so auth + workspace scoping is consistent.
 *
 * Memoized per request with React `cache`. A single navigation renders the
 * dashboard layout and the page, and previously each call re-ran
 * `auth.getUser()` plus a workspaces lookup — two extra round trips per page
 * view for data that cannot change mid-render.
 */
export const getAuthedContext = requestMemo(async function getAuthedContext(): Promise<
  Result<AuthedContext>
> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id, slug")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  if (!workspace) {
    return err({ code: "NOT_FOUND", message: "Workspace not found" });
  }

  return ok({
    supabase,
    userId: user.id,
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
  });
});
