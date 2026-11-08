import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client bound to the request cookie store.
 * Use inside Server Components, Server Actions, and Route Handlers.
 */
export async function createServerSupabaseClient() {
  // `cookies()` is async from Next 15 and synchronous access was removed in 16.
  const cookieStore = await cookies();

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
