import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const secret: { value: string | undefined } = { value: undefined };
  const pollResult: { value: unknown } = { value: { ok: true, value: [] } };
  return { secret, pollResult, polled: vi.fn() };
});

vi.mock("@/lib/env", () => ({
  get env() {
    return { CRON_SECRET: h.secret.value };
  },
}));
vi.mock("@/features/email-intake", () => ({
  pollAllMailboxes: () => {
    h.polled();
    return Promise.resolve(h.pollResult.value);
  },
}));

const { GET } = await import("../route");

const SECRET = "s3cret-that-is-long-enough";

function request(auth?: string): NextRequest {
  return {
    headers: new Headers(auth ? { authorization: auth } : {}),
  } as unknown as NextRequest;
}

beforeEach(() => {
  h.secret.value = SECRET;
  h.pollResult.value = { ok: true, value: [{ created: 2 }, { created: 0 }] };
  h.polled.mockReset();
});

describe("GET /api/cron/email-intake", () => {
  /** This route reads people's mailboxes. Open is worse than off. */
  it("refuses to run with no CRON_SECRET configured", async () => {
    h.secret.value = undefined;
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(503);
    expect(h.polled).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong bearer token", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer nope"))).status).toBe(401);
    expect((await GET(request(`Bearer ${SECRET}x`))).status).toBe(401);
    expect(h.polled).not.toHaveBeenCalled();
  });

  it("polls and reports what it made", async () => {
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mailboxes: 2, created: 2 });
  });

  /** 503 so a failing run is visible in Vercel's cron history. */
  it("answers 503 when the poll fails", async () => {
    h.pollResult.value = { ok: false, error: { code: "DB_ERROR", message: "down" } };
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(503);
  });
});
