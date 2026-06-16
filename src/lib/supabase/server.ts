import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client bound to the request cookie store.
 * Use inside Server Components, Server Actions, and Route Handlers.
 */
export function createServerSupabaseClient() {
  // In Next.js 14 `cookies()` is synchronous. Call sites may still `await` the
  // returned client harmlessly, keeping them forward-compatible with Next 15+.
  const cookieStore = cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `setAll` was called from a Server Component, where cookies are
            // read-only. Session refresh is handled by the middleware instead.
          }
        },
      },
    },
  );
}
