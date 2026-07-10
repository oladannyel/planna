import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { buildSlug, slugToken } from "./slug";

export interface WorkspaceRef {
  id: string;
  slug: string;
}

const MAX_SLUG_ATTEMPTS = 5;
const POSTGRES_UNIQUE_VIOLATION = "23505";

/**
 * Idempotently ensure the authenticated user has a workspace, creating one with
 * a generated unique slug on first login. Returns the workspace id + slug.
 */
export async function ensureWorkspace(): Promise<Result<WorkspaceRef>> {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  const { data: existing, error: selectError } = await supabase
    .from("workspaces")
    .select("id, slug")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (selectError) {
    return err({ code: "DB_ERROR", message: selectError.message });
  }

  if (existing) {
    return ok({ id: existing.id, slug: existing.slug });
  }

  const emailLocal = user.email?.split("@")[0] ?? "workspace";
  const name = `${emailLocal}'s workspace`;

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const slug = buildSlug(emailLocal, slugToken(crypto.randomUUID()));

    const { data, error } = await supabase
      .from("workspaces")
      .insert({ owner_id: user.id, name, slug })
      .select("id, slug")
      .single();

    if (!error && data) {
      return ok({ id: data.id, slug: data.slug });
    }

    if (error && error.code !== POSTGRES_UNIQUE_VIOLATION) {
      return err({ code: "DB_ERROR", message: error.message });
    }
    // Unique violation on slug — retry with a fresh token.
  }

  return err({
    code: "DB_ERROR",
    message: "Could not allocate a unique workspace slug",
  });
}
