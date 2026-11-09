import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  ingestRequest: vi.fn(),
  requestHeaders: { value: new Headers({ "x-forwarded-for": "203.0.113.5" }) },
}));

vi.mock("../ingest", () => ({ ingestRequest: h.ingestRequest }));
// `headers()` only resolves inside a request scope, which a unit test has no
// way to enter. Standing it in keeps this a test of the action's own logic.
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(h.requestHeaders.value) }));

const { submitRequest } = await import("../actions");

const valid = {
  slug: "demo",
  requesterName: "Ada",
  title: "Fix the export bug",
  description: "CSV export drops the last row for large datasets.",
  urgency: "high",
};

beforeEach(() => {
  h.ingestRequest.mockReset();
  h.requestHeaders.value = new Headers({ "x-forwarded-for": "203.0.113.5" });
});

describe("submitRequest", () => {
  it("rejects invalid input without ingesting", async () => {
    const result = await submitRequest({ slug: "demo", title: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(h.ingestRequest).not.toHaveBeenCalled();
  });

  it("delegates valid input to ingestRequest", async () => {
    h.ingestRequest.mockResolvedValue({ ok: true, value: { taskId: "t1" } });
    const result = await submitRequest(valid);
    expect(result.ok).toBe(true);
    expect(h.ingestRequest).toHaveBeenCalledTimes(1);
  });

  /**
   * A server action's arguments come from the browser, so the address has to
   * be read from the request headers on the server. Taking it from the input
   * would let a caller nominate whose quota to spend.
   */
  it("takes the client address from the request headers, not the input", async () => {
    h.ingestRequest.mockResolvedValue({ ok: true, value: { taskId: "t1" } });
    h.requestHeaders.value = new Headers({ "x-real-ip": "198.51.100.42" });

    await submitRequest({ ...valid, address: "1.2.3.4" });

    expect(h.ingestRequest).toHaveBeenCalledWith(expect.objectContaining({ slug: "demo" }), {
      address: "198.51.100.42",
    });
  });

  it("passes a null address through when no header identifies the caller", async () => {
    h.ingestRequest.mockResolvedValue({ ok: true, value: { taskId: "t1" } });
    h.requestHeaders.value = new Headers();

    await submitRequest(valid);

    expect(h.ingestRequest).toHaveBeenCalledWith(expect.anything(), { address: null });
  });
});
