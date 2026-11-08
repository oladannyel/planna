import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestInputSchema } from "@/features/tasks/schema";

const h = vi.hoisted(() => {
  const wsResult: { value: { data: unknown; error: unknown } } = {
    value: { data: { id: "ws-1" }, error: null },
  };
  const insertResult: { value: { data: unknown; error: unknown } } = {
    value: { data: { id: "task-99" }, error: null },
  };
  const parseResult: { value: unknown } = { value: { ok: false, error: {} } };
  const countResult: { value: { count: number | null; error: unknown } } = {
    value: { count: 0, error: null },
  };
  const insertArg = vi.fn();
  const parseCalled = vi.fn();

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    maybeSingle: () => Promise.resolve(wsResult.value),
    single: () => Promise.resolve(insertResult.value),
    insert: (arg: unknown) => {
      insertArg(arg);
      return builder;
    },
    // Awaiting the builder resolves the head/count query.
    then: (resolve: (v: unknown) => unknown) => resolve(countResult.value),
  };

  const admin = { from: () => builder };
  return { wsResult, insertResult, parseResult, countResult, insertArg, parseCalled, admin };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/features/tasks/parser", () => ({
  parseTaskFromText: () => {
    h.parseCalled();
    return Promise.resolve(h.parseResult.value);
  },
}));

const { ingestRequest, REQUEST_HOURLY_LIMIT } = await import("../ingest");

const input: RequestInputSchema = {
  slug: "demo",
  requesterName: "Ada",
  title: "Fix the export bug",
  description: "CSV export drops the last row for large datasets.",
  urgency: "high",
  desiredDeadline: "2026-06-30",
};

beforeEach(() => {
  h.wsResult.value = { data: { id: "ws-1" }, error: null };
  h.insertResult.value = { data: { id: "task-99" }, error: null };
  h.parseResult.value = { ok: false, error: { code: "AI_ERROR", message: "x" } };
  h.countResult.value = { count: 0, error: null };
  h.insertArg.mockReset();
  h.parseCalled.mockReset();
});

describe("ingestRequest", () => {
  it("returns NOT_FOUND for an unknown slug", async () => {
    h.wsResult.value = { data: null, error: null };
    const result = await ingestRequest(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    expect(h.insertArg).not.toHaveBeenCalled();
  });

  it("returns DB_ERROR when the workspace lookup fails", async () => {
    h.wsResult.value = { data: null, error: { message: "boom" } };
    const result = await ingestRequest(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });

  it("uses AI-enriched values when parsing succeeds", async () => {
    h.parseResult.value = {
      ok: true,
      value: {
        title: "Fix CSV export",
        priority: "urgent",
        tags: ["bug", "export"],
        dueDate: "2026-06-25",
        estimatedMinutes: 60,
        confidence: 0.8,
      },
    };
    const result = await ingestRequest(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.taskId).toBe("task-99");

    const payload = h.insertArg.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.title).toBe("Fix CSV export");
    expect(payload.priority).toBe("urgent");
    expect(payload.tags).toEqual(["bug", "export"]);
    expect(payload.due_date).toBe("2026-06-25");
    expect(payload.source).toBe("request_link");
    expect(payload.requested_by).toBe("Ada");
  });

  it("falls back to submitted values when parsing fails", async () => {
    h.parseResult.value = { ok: false, error: { code: "AI_ERROR", message: "x" } };
    const result = await ingestRequest(input);
    expect(result.ok).toBe(true);

    const payload = h.insertArg.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.title).toBe("Fix the export bug");
    expect(payload.priority).toBe("high");
    expect(payload.tags).toEqual([]);
    expect(payload.due_date).toBe("2026-06-30");
  });

  it("returns DB_ERROR when the insert fails", async () => {
    h.insertResult.value = { data: null, error: { message: "insert boom" } };
    const result = await ingestRequest(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});

/**
 * Request links are unauthenticated by design, so this is the only path where
 * a stranger can make the workspace owner spend money.
 */
describe("ingestRequest throttling", () => {
  it("accepts a submission below the hourly limit", async () => {
    h.countResult.value = { count: REQUEST_HOURLY_LIMIT - 1, error: null };
    const result = await ingestRequest(input);
    expect(result.ok).toBe(true);
  });

  it("rejects a submission once the workspace is at its hourly limit", async () => {
    h.countResult.value = { count: REQUEST_HOURLY_LIMIT, error: null };
    const result = await ingestRequest(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("RATE_LIMIT");
  });

  /** The expensive half of the attack: rejecting after the call is too late. */
  it("refuses before spending a model call", async () => {
    h.countResult.value = { count: REQUEST_HOURLY_LIMIT, error: null };
    await ingestRequest(input);
    expect(h.parseCalled).not.toHaveBeenCalled();
    expect(h.insertArg).not.toHaveBeenCalled();
  });

  it("surfaces a failure to read the counter rather than failing open", async () => {
    h.countResult.value = { count: null, error: { message: "counter down" } };
    const result = await ingestRequest(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
    expect(h.parseCalled).not.toHaveBeenCalled();
  });

  it("treats a null count as zero rather than blocking everything", async () => {
    h.countResult.value = { count: null, error: null };
    const result = await ingestRequest(input);
    expect(result.ok).toBe(true);
  });
});
