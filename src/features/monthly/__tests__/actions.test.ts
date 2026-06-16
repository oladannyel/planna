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
    due_date: "2026-06-10",
    estimated_minutes: null,
    source: "manual",
    requested_by: null,
    carried_over: false,
    carry_count: 0,
    status_history: [],
    completed_at: "2026-06-10T10:00:00.000Z",
    created_at: "2026-06-05T09:00:00.000Z",
    updated_at: "2026-06-10T10:00:00.000Z",
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
    value: { choices: [{ message: { content: "Narrative." } }] },
  };
  const createThrows = { value: false };
  const upsertArg = vi.fn();
  const create = vi.fn();

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
    supabase,
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/workspace/queries", () => ({
  getAuthedContext: () => Promise.resolve(h.ctxResult.value),
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

const { generateMonthlySummary } = await import("../actions");

beforeEach(() => {
  h.ctxResult.value = {
    ok: true,
    value: { supabase: h.supabase, userId: "u1", workspaceId: "ws-1" },
  };
  h.tasksResult.value = { data: [makeRow()], error: null };
  h.upsertResult.value = { error: null };
  h.createResult.value = { choices: [{ message: { content: "Narrative." } }] };
  h.createThrows.value = false;
  h.upsertArg.mockReset();
  h.create.mockReset();
});

describe("generateMonthlySummary", () => {
  it("propagates an unauthorized context", async () => {
    h.ctxResult.value = { ok: false, error: { code: "UNAUTHORIZED", message: "no" } };
    const result = await generateMonthlySummary(2026, 6);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNAUTHORIZED");
  });

  it("returns DB_ERROR when the task query fails", async () => {
    h.tasksResult.value = { data: null, error: { message: "boom" } };
    const result = await generateMonthlySummary(2026, 6);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });

  it("skips AI and storage for an empty month", async () => {
    h.tasksResult.value = { data: [], error: null };
    const result = await generateMonthlySummary(2026, 6);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(h.create).not.toHaveBeenCalled();
    expect(h.upsertArg).not.toHaveBeenCalled();
  });

  it("generates, upserts, and returns the narrative + stats", async () => {
    const result = await generateMonthlySummary(2026, 6);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.narrative).toBe("Narrative.");
      expect(result.value.stats.totalCompleted).toBe(1);
    }
    expect(h.create).toHaveBeenCalledTimes(1);
    const payload = h.upsertArg.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.year).toBe(2026);
    expect(payload.month).toBe(6);
    expect(payload.narrative).toBe("Narrative.");
  });

  it("falls back to a placeholder when the model returns empty content", async () => {
    h.createResult.value = { choices: [{ message: { content: null } }] };
    const result = await generateMonthlySummary(2026, 6);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.narrative).toBe("Summary unavailable.");
  });

  it("returns AI_ERROR when the model call throws", async () => {
    h.createThrows.value = true;
    const result = await generateMonthlySummary(2026, 6);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AI_ERROR");
    expect(h.upsertArg).not.toHaveBeenCalled();
  });

  it("returns DB_ERROR when the upsert fails", async () => {
    h.upsertResult.value = { error: { message: "upsert boom" } };
    const result = await generateMonthlySummary(2026, 6);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});
