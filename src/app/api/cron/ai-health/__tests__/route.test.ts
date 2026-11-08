import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HealthReport } from "@/features/ai-health";

const h = vi.hoisted(() => ({ report: { value: null as HealthReport | null } }));

vi.mock("@/features/ai-health", () => ({
  runHealthCheck: () => Promise.resolve(h.report.value),
}));

const { GET } = await import("../route");

function request(auth?: string): Request {
  return new Request("https://planna.test/api/cron/ai-health", {
    headers: auth ? { authorization: auth } : {},
  });
}

const healthy: HealthReport = {
  checkedAt: "2026-11-08T07:00:00.000Z",
  healthy: true,
  key: { alive: true, status: 200 },
  models: [{ model: "openrouter/free", verdict: "ok", servedBy: "x/y:free" }],
};

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret";
  h.report.value = healthy;
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("GET /api/cron/ai-health", () => {
  it("returns 200 when everything is healthy", async () => {
    const response = await GET(request("Bearer s3cret") as never);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ healthy: true });
  });

  it("returns 503 when the check fails, so Vercel marks the run failed", async () => {
    h.report.value = {
      ...healthy,
      healthy: false,
      key: { alive: false, status: 401, detail: "User not found." },
    };
    const response = await GET(request("Bearer s3cret") as never);
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

  /** Fail closed: an unconfigured route must not be an open quota drain. */
  it("refuses to run when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(request("Bearer anything") as never);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "CRON_SECRET is not configured",
    });
  });
});
