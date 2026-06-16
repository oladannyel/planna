import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const ctxResult: { value: unknown } = { value: null };
  const rowResult: { value: { data: unknown; error: unknown } } = {
    value: { data: null, error: null },
  };
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(rowResult.value),
  };
  const supabase = { from: () => builder };
  return { ctxResult, rowResult, supabase };
});

vi.mock("@/features/workspace/queries", () => ({
  getAuthedContext: () => Promise.resolve(h.ctxResult.value),
}));

const { getMonthlySummary } = await import("../queries");

beforeEach(() => {
  h.ctxResult.value = {
    ok: true,
    value: { supabase: h.supabase, userId: "u1", workspaceId: "ws-1" },
  };
  h.rowResult.value = { data: null, error: null };
});

describe("getMonthlySummary", () => {
  it("returns null when no summary exists", async () => {
    const result = await getMonthlySummary(2026, 6);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it("returns the stored narrative when present", async () => {
    h.rowResult.value = {
      data: { narrative: "Stored.", created_at: "2026-06-30T00:00:00.000Z" },
      error: null,
    };
    const result = await getMonthlySummary(2026, 6);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.narrative).toBe("Stored.");
  });

  it("propagates context errors", async () => {
    h.ctxResult.value = { ok: false, error: { code: "UNAUTHORIZED", message: "no" } };
    const result = await getMonthlySummary(2026, 6);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNAUTHORIZED");
  });

  it("returns DB_ERROR on query failure", async () => {
    h.rowResult.value = { data: null, error: { message: "boom" } };
    const result = await getMonthlySummary(2026, 6);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});
