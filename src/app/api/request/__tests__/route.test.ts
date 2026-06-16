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

function request(body: unknown, throwOnJson = false): NextRequest {
  return {
    json: () => (throwOnJson ? Promise.reject(new Error("bad json")) : Promise.resolve(body)),
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
});
