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

export interface SessionOptions {
  /**
   * Headers to present to the application as the incoming request's — how the
   * CSP nonce reaches Next's script injection and the root layout.
   */
  requestHeaders?: Headers;
  /** Headers to set on whatever response is returned, redirects included. */
  responseHeaders?: Record<string, string>;
}

/**
 * Refreshes the Supabase auth session on every request and gates private
 * routes. Returns the response (with refreshed cookies) to the proxy.
 */
export async function updateSession(
  request: NextRequest,
  options: SessionOptions = {},
): Promise<NextResponse> {
  const { requestHeaders, responseHeaders } = options;

  /**
   * Applied to every exit from this function. A redirect to /login is still a
   * response the browser renders, so it needs the same headers as a page —
   * and a policy that only covers the happy path is a policy with a hole in
   * exactly the place an unauthenticated visitor lands.
   */
  const withHeaders = (res: NextResponse): NextResponse => {
    if (responseHeaders) {
      for (const [name, value] of Object.entries(responseHeaders)) {
        res.headers.set(name, value);
      }
    }
    return res;
  };

  const nextWithRequest = () =>
    NextResponse.next(requestHeaders ? { request: { headers: requestHeaders } } : { request });

  let response = nextWithRequest();

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
          response = nextWithRequest();
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
    return withHeaders(NextResponse.redirect(loginUrl));
  }

  return withHeaders(response);
}
