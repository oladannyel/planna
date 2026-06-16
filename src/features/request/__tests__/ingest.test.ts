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
  const insertArg = vi.fn();

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(wsResult.value),
    single: () => Promise.resolve(insertResult.value),
    insert: (arg: unknown) => {
      insertArg(arg);
      return builder;
    },
  };

  const admin = { from: () => builder };
  return { wsResult, insertResult, parseResult, insertArg, admin };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/features/tasks/parser", () => ({
  parseTaskFromText: () => Promise.resolve(h.parseResult.value),
}));

const { ingestRequest } = await import("../ingest");

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
  h.insertArg.mockReset();
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
