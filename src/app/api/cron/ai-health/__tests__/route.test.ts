import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HealthReport } from "@/features/ai-health";

const h = vi.hoisted(() => ({
  report: { value: null as HealthReport | null },
  // `env` is parsed once at module load, so the secret has to be mocked rather
  // than assigned to process.env mid-test. That is also how it behaves in
  // production: changing the secret takes a redeploy, not a request.
  secret: { value: undefined as string | undefined },
  prune: vi.fn(),
}));

vi.mock("@/features/ai-health", () => ({
  runHealthCheck: () => Promise.resolve(h.report.value),
}));

vi.mock("@/lib/env", () => ({
  get env() {
    return { CRON_SECRET: h.secret.value };
  },
}));

vi.mock("@/lib/throttle-maintenance", () => ({
  pruneRequestThrottle: () => {
    h.prune();
    return Promise.resolve({ ok: true, value: { deleted: 3 } });
  },
}));

const { GET } = await import("../route");

function request(auth?: string): Request {
  return new Request("https://planna.test/api/cron/ai-health", {
    headers: auth ? { authorization: auth } : {},
  });
}

const SECRET = "s3cret-that-is-long-enough";

const healthy: HealthReport = {
  checkedAt: "2026-11-08T07:00:00.000Z",
  healthy: true,
  key: { alive: true, status: 200 },
  models: [{ model: "openrouter/free", verdict: "ok", servedBy: "x/y:free" }],
};

beforeEach(() => {
  h.secret.value = SECRET;
  h.report.value = healthy;
  h.prune.mockReset();
});

describe("GET /api/cron/ai-health", () => {
  it("returns 200 when everything is healthy", async () => {
    const response = await GET(request(`Bearer ${SECRET}`) as never);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ healthy: true });
  });

  it("returns 503 when the check fails, so Vercel marks the run failed", async () => {
    h.report.value = {
      ...healthy,
      healthy: false,
      key: { alive: false, status: 401, detail: "User not found." },
    };
    const response = await GET(request(`Bearer ${SECRET}`) as never);
    expect(response.status).toBe(503);
  });

  it("rejects a request with the wrong secret", async () => {
    const response = await GET(request("Bearer wrong") as never);
    expect(response.status).toBe(401);
  });

  it("rejects a request with no authorization at all", async () => {
    const response = await GET(request() as never);
    expect(response.status).toBe(401);
  });

  /**
   * A prefix match must not pass. The comparison is length-checked and then
   * constant-time, so neither a truncated nor an extended secret is accepted,
   * and neither reveals how much of it was right.
   */
  it("rejects a secret that is a prefix of the real one", async () => {
    const response = await GET(request(`Bearer ${SECRET.slice(0, -1)}`) as never);
    expect(response.status).toBe(401);
  });

  it("rejects a secret with the right prefix and extra bytes", async () => {
    const response = await GET(request(`Bearer ${SECRET}x`) as never);
    expect(response.status).toBe(401);
  });

  it("rejects the bare secret without the Bearer scheme", async () => {
    const response = await GET(request(SECRET) as never);
    expect(response.status).toBe(401);
  });

  /** Fail closed: an unconfigured route must not be an open quota drain. */
  it("refuses to run when CRON_SECRET is not configured", async () => {
    h.secret.value = undefined;
    const response = await GET(request("Bearer anything") as never);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "CRON_SECRET is not configured",
    });
  });

  it("does not run the health check when unauthorised", async () => {
    h.secret.value = undefined;
    await GET(request("Bearer anything") as never);
    expect(h.prune).not.toHaveBeenCalled();
  });

  it("prunes closed throttle windows on an authorised run", async () => {
    await GET(request(`Bearer ${SECRET}`) as never);
    expect(h.prune).toHaveBeenCalledTimes(1);
  });
});
