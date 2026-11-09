/**
 * Security response headers, including a per-request nonce-based Content
 * Security Policy.
 *
 * These are deliberately built here rather than declared in `next.config.mjs`.
 * A CSP worth having needs a fresh nonce per response, and a static config
 * file cannot produce one — which is the usual reason a project ends up with
 * `script-src 'unsafe-inline'` and a policy that stops nothing.
 */

/**
 * Per-request nonce. 128 bits, base64. `crypto` is the Web Crypto global,
 * available on both the Node and edge runtimes without an import.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export interface CspOptions {
  nonce: string;
  /** The Supabase project URL — the one origin the browser must reach. */
  supabaseUrl: string;
  /** Relaxes the policy for the dev server's tooling. Never true in a build. */
  development?: boolean;
}

/**
 * Build the CSP header value.
 *
 * Two directives are weaker than the rest, and both are load-bearing rather
 * than lazy:
 *
 * - **`style-src 'unsafe-inline'`.** Next injects inline `<style>` for
 *   critical CSS and Recharts sets inline `style` attributes on the SVG nodes
 *   it renders. Neither can carry a nonce, and a nonce on a `style` attribute
 *   is not a thing CSP offers. The exposure is CSS injection, not script
 *   execution, which is the trade every React app on a strict policy makes.
 * - **`'unsafe-eval'` in development only.** Turbopack's hot reload compiles
 *   with `eval`. Gated on the flag so it cannot reach a production response.
 *
 * `'strict-dynamic'` is what makes the nonce useful beyond the one inline
 * script: it lets a nonce-carrying script load the app's own chunks without
 * every chunk URL needing an allowlist entry, and it makes supporting browsers
 * ignore the host-based `'self'` fallback, so an injected `<script src>` on a
 * same-origin path still fails.
 */
export function buildCsp({ nonce, supabaseUrl, development = false }: CspOptions): string {
  // Realtime connects over WebSocket to the same host as the REST API.
  const supabaseOrigin = safeOrigin(supabaseUrl);
  const supabaseSocket = supabaseOrigin ? supabaseOrigin.replace(/^http/, "ws") : null;

  const connect = ["'self'", supabaseOrigin, supabaseSocket].filter(Boolean) as string[];
  if (development) connect.push("ws://localhost:*", "http://localhost:*");

  const script = [`'nonce-${nonce}'`, "'strict-dynamic'", "'self'"];
  if (development) script.push("'unsafe-eval'");

  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", script],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:"]],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", connect],
    // next/font/google self-hosts at build time, so no external font origin is
    // needed and none is allowed.
    ["frame-src", ["'none'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    // Clickjacking, stated to browsers that honour CSP over X-Frame-Options.
    ["frame-ancestors", ["'none'"]],
  ];

  const policy = directives.map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!development) policy.push("upgrade-insecure-requests");

  return policy.join("; ");
}

/**
 * Headers that do not vary per request.
 *
 * HSTS is omitted in development: pinning `localhost` to HTTPS for two years
 * is a genuinely annoying thing to do to a contributor's browser, and it is
 * not reversible from the server side.
 */
export function staticSecurityHeaders(development = false): Record<string, string> {
  const headers: Record<string, string> = {
    // Belt and braces with frame-ancestors, for anything that predates CSP 2.
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Nothing in plAnna asks for any of these, so refuse them all up front.
    "Permissions-Policy": [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "accelerometer=()",
      "gyroscope=()",
    ].join(", "),
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "off",
  };

  if (!development) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }

  return headers;
}

/** Origin of a URL, or null if it will not parse — never throws on bad config. */
function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
