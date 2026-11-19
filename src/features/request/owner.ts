import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Who the request form says the request is going to.
 *
 * The person handing out the link is the person the submitter is writing to,
 * so the form names them: "Submit a request to Daniel", not the anonymous
 * "Submit a request" it used to show. A form that does not say who is on the
 * other end reads like a generic contact page, which is exactly the thing a
 * personal request link is not.
 *
 * Where the name comes from, in order:
 *
 *  1. `display_name` in the owner's auth metadata — what they typed into the
 *     share popover. Metadata rather than a new column because this is one
 *     string on one person: a migration for it would have to be applied to
 *     production by hand, which is this project's recurring failure mode.
 *  2. `full_name`, in case an OAuth provider supplied one.
 *  3. The workspace name with the generated "…'s workspace" wrapper removed.
 *  4. Nothing — the heading falls back to "Submit a request".
 *
 * Note that a valid slug now renders a name and an invalid one does not, so
 * this page distinguishes real slugs from guesses where previously only the
 * (throttled) submit did. Slugs carry a random token and the page exists to
 * be shared, so the exposure is the owner's display name to someone who
 * already holds their link.
 */

const GENERATED_SUFFIX = /[’']s workspace$/i;

/** Pick a display name from the owner's metadata and workspace name. */
export function ownerDisplayName(
  metadata: { display_name?: unknown; full_name?: unknown } | null | undefined,
  workspaceName: string | null | undefined,
): string | null {
  for (const candidate of [metadata?.display_name, metadata?.full_name]) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  const fromWorkspace = workspaceName?.replace(GENERATED_SUFFIX, "").trim();
  return fromWorkspace && fromWorkspace.length > 0 ? fromWorkspace : null;
}

/** Resolve the owner's display name for a public request slug. */
export async function requestOwnerName(slug: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data: workspace, error } = await admin
    .from("workspaces")
    .select("name, owner_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !workspace) return null;

  const { data } = await admin.auth.admin.getUserById(workspace.owner_id);
  const metadata = data?.user?.user_metadata as
    { display_name?: unknown; full_name?: unknown } | undefined;

  return ownerDisplayName(metadata, workspace.name);
}
