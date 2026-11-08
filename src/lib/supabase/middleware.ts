import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/** Routes reachable without an authenticated session. */
const PUBLIC_PREFIXES = [
  "/login",
  "/auth",
  "/request", // public request form
  "/api/request", // public request ingestion (service-role, slug-validated)
  // Scheduled jobs. These carry no session cookie, so session gating would
  // bounce them to /login and the job would silently never run. They
  // authenticate themselves with a bearer CRON_SECRET instead, and refuse to
  // run when it is unset.
  "/api/cron",
  "/_next",
  "/favicon.ico",
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Refreshes the Supabase auth session on every request and gates private
 * routes. Returns the response (with refreshed cookies) to the middleware.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
