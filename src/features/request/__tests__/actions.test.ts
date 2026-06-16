import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ ingestRequest: vi.fn() }));

vi.mock("../ingest", () => ({ ingestRequest: h.ingestRequest }));

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
});
