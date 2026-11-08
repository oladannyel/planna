import { describe, expect, it } from "vitest";

import { isPublicPath } from "../middleware";

describe("isPublicPath", () => {
  it("gates the app routes behind a session", () => {
    for (const path of ["/", "/board", "/daily", "/analytics", "/board/archive/done"]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });

  it("lets the auth and login flows through", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("lets the public request form and its ingestion endpoint through", () => {
    expect(isPublicPath("/request")).toBe(true);
    expect(isPublicPath("/api/request")).toBe(true);
  });

  /**
   * Scheduled jobs carry no session cookie. Gating them produced a 307 to
   * /login, which a cron runner reports as a success — the job would never
   * have run and nothing would have said so.
   */
  it("lets scheduled jobs through to their own bearer-token check", () => {
    expect(isPublicPath("/api/cron")).toBe(true);
    expect(isPublicPath("/api/cron/ai-health")).toBe(true);
  });

  it("does not treat a prefix match on a longer segment as public", () => {
    expect(isPublicPath("/api/cronjobs")).toBe(false);
    expect(isPublicPath("/requests-archive")).toBe(false);
    expect(isPublicPath("/logins")).toBe(false);
  });
});
