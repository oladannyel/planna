import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  ingestRequest: vi.fn(),
  acceptRequest: vi.fn(),
  rejectRequest: vi.fn(),
  requestHeaders: {
    value: new Headers({ "x-forwarded-for": "203.0.113.5", host: "planna.test" }),
  },
}));

vi.mock("../ingest", () => ({ ingestRequest: h.ingestRequest }));
vi.mock("../decide", () => ({
  acceptRequest: h.acceptRequest,
  rejectRequest: h.rejectRequest,
}));
// `headers()` only resolves inside a request scope, which a unit test has no
// way to enter. Standing it in keeps this a test of the action's own logic.
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(h.requestHeaders.value) }));

const { submitRequest, acceptRequest, rejectRequest } = await import("../actions");

const valid = {
  slug: "demo",
  requesterName: "Ada",
  title: "Fix the export bug",
  description: "CSV export drops the last row for large datasets.",
  urgency: "high",
};

const ORIGIN = "https://planna.test";

beforeEach(() => {
  h.ingestRequest.mockReset();
  h.acceptRequest.mockReset();
  h.rejectRequest.mockReset();
  h.requestHeaders.value = new Headers({ "x-forwarded-for": "203.0.113.5", host: "planna.test" });
});

describe("submitRequest", () => {
  it("rejects invalid input without ingesting", async () => {
    const result = await submitRequest({ slug: "demo", title: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(h.ingestRequest).not.toHaveBeenCalled();
  });

  it("delegates valid input to ingestRequest", async () => {
    h.ingestRequest.mockResolvedValue({ ok: true, value: { requestId: "req-1", statusUrl: "s" } });
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
    h.ingestRequest.mockResolvedValue({ ok: true, value: { requestId: "req-1", statusUrl: "s" } });
    h.requestHeaders.value = new Headers({ "x-real-ip": "198.51.100.42", host: "planna.test" });

    await submitRequest({ ...valid, address: "1.2.3.4" });

    expect(h.ingestRequest).toHaveBeenCalledWith(expect.objectContaining({ slug: "demo" }), {
      address: "198.51.100.42",
      origin: ORIGIN,
    });
  });

  it("passes a null address through when no header identifies the caller", async () => {
    h.ingestRequest.mockResolvedValue({ ok: true, value: { requestId: "req-1", statusUrl: "s" } });
    h.requestHeaders.value = new Headers({ host: "planna.test" });

    await submitRequest(valid);

    expect(h.ingestRequest).toHaveBeenCalledWith(expect.anything(), {
      address: null,
      origin: ORIGIN,
    });
  });
});

/**
 * The thin "use server" wrappers. The logic they guard lives in `decide.ts`
 * and is tested there; what matters here is that neither hands an unchecked
 * client value through.
 */
describe("decision actions", () => {
  it("rejects an id that is not a non-empty string", async () => {
    for (const bad of ["", null, 42, undefined]) {
      const accepted = await acceptRequest(bad as unknown as string);
      const rejected = await rejectRequest(bad as unknown as string);
      expect(accepted.ok).toBe(false);
      expect(rejected.ok).toBe(false);
    }
    expect(h.acceptRequest).not.toHaveBeenCalled();
    expect(h.rejectRequest).not.toHaveBeenCalled();
  });

  it("passes a valid id through", async () => {
    h.acceptRequest.mockResolvedValue({ ok: true, value: { requestId: "r", taskId: "t" } });
    h.rejectRequest.mockResolvedValue({ ok: true, value: { requestId: "r" } });

    await acceptRequest("req-1");
    await rejectRequest("req-1", "No capacity");

    expect(h.acceptRequest).toHaveBeenCalledWith("req-1");
    expect(h.rejectRequest).toHaveBeenCalledWith("req-1", "No capacity");
  });

  /** A non-string reason from a client must not reach the database. */
  it("drops a reason that is not a string", async () => {
    h.rejectRequest.mockResolvedValue({ ok: true, value: { requestId: "r" } });
    await rejectRequest("req-1", { toString: () => "x" } as unknown as string);
    expect(h.rejectRequest).toHaveBeenCalledWith("req-1", undefined);
  });
});
