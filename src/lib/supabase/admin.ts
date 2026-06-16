import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client. Bypasses RLS — SERVER ONLY. Never import this
 * from client components. Used by the public request-link ingestion path after
 * the workspace slug has been validated.
 */
export function createAdminClient() {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
