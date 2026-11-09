import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ ingestRequest: vi.fn() }));

vi.mock("@/features/request/ingest", () => ({ ingestRequest: h.ingestRequest }));

const { POST } = await import("../route");

const validBody = {
  slug: "demo",
  requesterName: "Ada",
  title: "Fix the export bug",
  description: "CSV export drops the last row for large datasets.",
  urgency: "high",
};

function request(
  body: unknown,
  throwOnJson = false,
  headers: Record<string, string> = { "x-forwarded-for": "203.0.113.5" },
): NextRequest {
  return {
    json: () => (throwOnJson ? Promise.reject(new Error("bad json")) : Promise.resolve(body)),
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

beforeEach(() => {
  h.ingestRequest.mockReset();
});

describe("POST /api/request", () => {
  it("returns 400 for invalid JSON", async () => {
    const res = await POST(request(null, true));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid body", async () => {
    const res = await POST(request({ slug: "demo" }));
    expect(res.status).toBe(400);
    expect(h.ingestRequest).not.toHaveBeenCalled();
  });

  it("returns 201 on success", async () => {
    h.ingestRequest.mockResolvedValue({ ok: true, value: { taskId: "t1" } });
    const res = await POST(request(validBody));
    expect(res.status).toBe(201);
  });

  it("returns 404 for an unknown workspace slug", async () => {
    h.ingestRequest.mockResolvedValue({ ok: false, error: { code: "NOT_FOUND", message: "x" } });
    const res = await POST(request(validBody));
    expect(res.status).toBe(404);
  });

  it("returns 500 for other failures", async () => {
    h.ingestRequest.mockResolvedValue({ ok: false, error: { code: "DB_ERROR", message: "x" } });
    const res = await POST(request(validBody));
    expect(res.status).toBe(500);
  });

  it("returns 429 with Retry-After when throttled", async () => {
    h.ingestRequest.mockResolvedValue({
      ok: false,
      error: { code: "RATE_LIMIT", message: "too many" },
    });
    const res = await POST(request(validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3600");
  });

  /**
   * The throttle is only as good as the address it is given. The route reads
   * it from the request headers rather than from the body, where a client
   * could nominate someone else's quota.
   */
  it("forwards the client address from the request headers", async () => {
    h.ingestRequest.mockResolvedValue({ ok: true, value: { taskId: "t1" } });
    await POST(request(validBody, false, { "x-real-ip": "198.51.100.77" }));
    expect(h.ingestRequest).toHaveBeenCalledWith(expect.objectContaining({ slug: "demo" }), {
      address: "198.51.100.77",
    });
  });

  it("forwards a null address when no header identifies the caller", async () => {
    h.ingestRequest.mockResolvedValue({ ok: true, value: { taskId: "t1" } });
    await POST(request(validBody, false, {}));
    expect(h.ingestRequest).toHaveBeenCalledWith(expect.anything(), { address: null });
  });
});
