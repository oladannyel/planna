import type { NextRequest } from "next/server";

import { env } from "@/lib/env";
import { buildCsp, generateNonce, staticSecurityHeaders } from "@/lib/security-headers";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Renamed from `middleware` in Next 16: the convention is now `proxy`, which
 * runs on the Node.js runtime. plAnna never used the edge runtime here — it
 * refreshes the Supabase session cookie and gates private routes — so the
 * rename is behaviour-preserving.
 *
 * It also attaches the security headers, because the Content Security Policy
 * carries a per-request nonce and so cannot live in `next.config.mjs`. The
 * nonce goes onto the *request* as well as the response: Next reads the
 * incoming CSP header to stamp its own injected bootstrap scripts, and the
 * root layout reads `x-nonce` to stamp the inline theme script.
 */
export async function proxy(request: NextRequest) {
  const development = process.env.NODE_ENV !== "production";
  const nonce = generateNonce();
  const csp = buildCsp({
    nonce,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    development,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  return updateSession(request, {
    requestHeaders,
    responseHeaders: {
      ...staticSecurityHeaders(development),
      "Content-Security-Policy": csp,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Run on every request except static assets and image optimisation files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
