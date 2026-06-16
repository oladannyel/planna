import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

// Read the public vars directly rather than importing `@/lib/env`: that module
// also validates server-only secrets, which are absent from the browser bundle
// and would throw on the client. Next.js inlines NEXT_PUBLIC_* at build time.
function publicSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables",
    );
  }
  return { url, anonKey };
}

/** Browser-side Supabase client (uses the anon key + cookie session). */
export function createClient() {
  const { url, anonKey } = publicSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
