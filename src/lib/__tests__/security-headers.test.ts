import { describe, expect, it } from "vitest";

import { buildCsp, generateNonce, staticSecurityHeaders } from "../security-headers";

const SUPABASE = "https://abcdefgh.supabase.co";

function directives(csp: string): Map<string, string> {
  return new Map(
    csp.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name ?? "", values.join(" ")];
    }),
  );
}

describe("generateNonce", () => {
  it("is unique per call", () => {
    const nonces = new Set(Array.from({ length: 200 }, generateNonce));
    expect(nonces.size).toBe(200);
  });

  it("carries at least 128 bits", () => {
    // 16 bytes of base64 is 24 characters including padding.
    expect(generateNonce()).toHaveLength(24);
  });

  it("is base64, so it needs no escaping in a header", () => {
    expect(generateNonce()).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });
});

describe("buildCsp", () => {
  const csp = buildCsp({ nonce: "testnonce", supabaseUrl: SUPABASE });
  const d = directives(csp);

  it("carries the nonce in script-src", () => {
    expect(d.get("script-src")).toContain("'nonce-testnonce'");
  });

  it("uses strict-dynamic, so injected same-origin scripts still fail", () => {
    expect(d.get("script-src")).toContain("'strict-dynamic'");
  });

  it("never allows unsafe-inline scripts", () => {
    expect(d.get("script-src")).not.toContain("'unsafe-inline'");
  });

  it("allows the Supabase REST origin and its WebSocket origin", () => {
    expect(d.get("connect-src")).toContain("https://abcdefgh.supabase.co");
    expect(d.get("connect-src")).toContain("wss://abcdefgh.supabase.co");
  });

  it("does not allow arbitrary connect targets", () => {
    expect(d.get("connect-src")).not.toContain("*");
  });

  it("denies framing, plugins and base-tag hijacking", () => {
    expect(d.get("frame-ancestors")).toBe("'none'");
    expect(d.get("object-src")).toBe("'none'");
    expect(d.get("base-uri")).toBe("'self'");
    expect(d.get("form-action")).toBe("'self'");
  });

  it("sets default-src to self", () => {
    expect(d.get("default-src")).toBe("'self'");
  });

  describe("production vs development", () => {
    const dev = directives(buildCsp({ nonce: "n", supabaseUrl: SUPABASE, development: true }));

    it("allows eval only in development, for Turbopack's hot reload", () => {
      expect(dev.get("script-src")).toContain("'unsafe-eval'");
      expect(d.get("script-src")).not.toContain("'unsafe-eval'");
    });

    it("allows a local websocket only in development", () => {
      expect(dev.get("connect-src")).toContain("ws://localhost:*");
      expect(d.get("connect-src")).not.toContain("localhost");
    });

    it("upgrades insecure requests only in production", () => {
      expect(csp).toContain("upgrade-insecure-requests");
      expect(buildCsp({ nonce: "n", supabaseUrl: SUPABASE, development: true })).not.toContain(
        "upgrade-insecure-requests",
      );
    });
  });

  /**
   * `env.ts` validates the Supabase URL at startup, so an unparseable one
   * should not reach here — but a policy builder that throws would take down
   * every request, including the pages that would tell you why.
   */
  it("omits the Supabase origin rather than throwing on an unparseable URL", () => {
    const broken = directives(buildCsp({ nonce: "n", supabaseUrl: "not a url" }));
    expect(broken.get("connect-src")).toBe("'self'");
  });
});

describe("staticSecurityHeaders", () => {
  const prod = staticSecurityHeaders();

  it("denies framing", () => {
    expect(prod["X-Frame-Options"]).toBe("DENY");
  });

  it("stops MIME sniffing", () => {
    expect(prod["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("does not leak full URLs to other origins", () => {
    expect(prod["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("refuses the device APIs the app never uses", () => {
    expect(prod["Permissions-Policy"]).toContain("camera=()");
    expect(prod["Permissions-Policy"]).toContain("microphone=()");
    expect(prod["Permissions-Policy"]).toContain("geolocation=()");
  });

  it("sets a long HSTS max-age in production", () => {
    expect(prod["Strict-Transport-Security"]).toContain("max-age=63072000");
    expect(prod["Strict-Transport-Security"]).toContain("includeSubDomains");
  });

  /** Pinning localhost to HTTPS for two years is not undoable server-side. */
  it("omits HSTS in development", () => {
    expect(staticSecurityHeaders(true)["Strict-Transport-Security"]).toBeUndefined();
  });

  it("still sets the non-transport headers in development", () => {
    expect(staticSecurityHeaders(true)["X-Frame-Options"]).toBe("DENY");
  });
});
