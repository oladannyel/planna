import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

function makeRow(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: "task-1",
    workspace_id: "ws-1",
    title: "Task",
    description: null,
    status: "done",
    priority: "medium",
    tags: ["x"],
    due_date: null,
    estimated_minutes: null,
    source: "manual",
    requested_by: null,
    carried_over: false,
    carry_count: 0,
    status_history: [],
    completed_at: "2026-06-16T10:00:00.000Z",
    created_at: "2026-06-15T09:00:00.000Z",
    updated_at: "2026-06-16T10:00:00.000Z",
    ...overrides,
  };
}

const h = vi.hoisted(() => {
  const ctxResult: { value: unknown } = { value: null };
  const tasksResult: { value: { data: unknown; error: unknown } } = {
    value: { data: [], error: null },
  };
  const upsertResult: { value: { error: unknown } } = { value: { error: null } };
  const createResult: { value: unknown } = {
    value: { choices: [{ message: { content: "Weekly narrative." } }] },
  };
  const createThrows = { value: false };
  const upsertArg = vi.fn();
  const create = vi.fn();
  const generateMonthlySummary = vi.fn();

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    then: (resolve: (v: unknown) => unknown) => resolve(tasksResult.value),
    upsert: (arg: unknown) => {
      upsertArg(arg);
      return { then: (resolve: (v: unknown) => unknown) => resolve(upsertResult.value) };
    },
  };

  const supabase = { from: () => builder };
  return {
    ctxResult,
    tasksResult,
    upsertResult,
    createResult,
    createThrows,
    upsertArg,
    create,
    generateMonthlySummary,
    supabase,
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/workspace/queries", () => ({
  getAuthedContext: () => Promise.resolve(h.ctxResult.value),
}));
vi.mock("@/features/monthly/actions", () => ({
  generateMonthlySummary: (...args: unknown[]) => h.generateMonthlySummary(...args),
}));
vi.mock("@/lib/openrouter", () => ({
  getOpenRouter: () => ({
    chat: {
      completions: {
        create: (...args: unknown[]) => {
          h.create(...args);
          if (h.createThrows.value) return Promise.reject(new Error("ai down"));
          return Promise.resolve(h.createResult.value);
        },
      },
    },
  }),
}));

const { generateWeeklyReport, generateMonthlyReport, generateYearlySummary } =
  await import("../actions");

beforeEach(() => {
  h.ctxResult.value = {
    ok: true,
    value: { supabase: h.supabase, userId: "u1", workspaceId: "ws-1" },
  };
  h.tasksResult.value = { data: [makeRow()], error: null };
  h.upsertResult.value = { error: null };
  h.createResult.value = { choices: [{ message: { content: "Weekly narrative." } }] };
  h.createThrows.value = false;
  h.upsertArg.mockReset();
  h.create.mockReset();
  h.generateMonthlySummary.mockReset();
});

describe("generateWeeklyReport", () => {
  it("propagates an unauthorized context", async () => {
    h.ctxResult.value = { ok: false, error: { code: "UNAUTHORIZED", message: "no" } };
    const result = await generateWeeklyReport("2026-06-15");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNAUTHORIZED");
  });

  it("returns DB_ERROR when the task query fails", async () => {
    h.tasksResult.value = { data: null, error: { message: "boom" } };
    const result = await generateWeeklyReport("2026-06-15");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });

  it("skips AI and storage for an empty week", async () => {
    h.tasksResult.value = { data: [], error: null };
    const result = await generateWeeklyReport("2026-06-15");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(h.create).not.toHaveBeenCalled();
    expect(h.upsertArg).not.toHaveBeenCalled();
  });

  it("generates, upserts, and returns the narrative", async () => {
    const result = await generateWeeklyReport("2026-06-15");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.narrative).toBe("Weekly narrative.");
    const payload = h.upsertArg.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.week_start).toBe("2026-06-15");
  });

  it("returns AI_ERROR when the model throws", async () => {
    h.createThrows.value = true;
    const result = await generateWeeklyReport("2026-06-15");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AI_ERROR");
  });

  it("returns DB_ERROR when the upsert fails", async () => {
    h.upsertResult.value = { error: { message: "upsert boom" } };
    const result = await generateWeeklyReport("2026-06-15");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});

describe("generateMonthlyReport", () => {
  it("delegates to generateMonthlySummary", async () => {
    h.generateMonthlySummary.mockResolvedValue({ ok: true, value: { narrative: "m", stats: {} } });
    const result = await generateMonthlyReport(2026, 6);
    expect(result.ok).toBe(true);
    expect(h.generateMonthlySummary).toHaveBeenCalledWith(2026, 6);
  });
});

describe("generateYearlySummary", () => {
  it("is a NOT_FOUND stub", async () => {
    const result = await generateYearlySummary(2026);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });
});
