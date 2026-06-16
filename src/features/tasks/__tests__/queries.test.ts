import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

function makeRow(id: string): TaskRow {
  return {
    id,
    workspace_id: "ws-1",
    title: `Task ${id}`,
    description: null,
    status: "todo",
    priority: "medium",
    tags: [],
    due_date: "2026-06-18",
    estimated_minutes: null,
    source: "manual",
    requested_by: null,
    carried_over: false,
    carry_count: 0,
    status_history: [],
    completed_at: null,
    created_at: "2026-06-16T09:00:00.000Z",
    updated_at: "2026-06-16T09:00:00.000Z",
  };
}

const h = vi.hoisted(() => {
  const tableResult: { value: { data: unknown; error: unknown } } = {
    value: { data: null, error: null },
  };
  const ctxResult: { value: unknown } = { value: null };

  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "lte", "order"]) {
    builder[m] = () => builder;
  }
  builder.maybeSingle = () => Promise.resolve(tableResult.value);
  builder.then = (resolve: (v: unknown) => unknown) => resolve(tableResult.value);

  const supabase = { from: () => builder };
  return { tableResult, ctxResult, supabase };
});

vi.mock("@/features/workspace/queries", () => ({
  getAuthedContext: () => Promise.resolve(h.ctxResult.value),
}));

const { getTasks, getTaskById, getTasksInRange } = await import("../queries");

beforeEach(() => {
  h.ctxResult.value = {
    ok: true,
    value: { supabase: h.supabase, userId: "user-1", workspaceId: "ws-1" },
  };
  h.tableResult.value = { data: null, error: null };
});

describe("getTasks", () => {
  it("maps every row", async () => {
    h.tableResult.value = { data: [makeRow("a"), makeRow("b")], error: null };
    const result = await getTasks();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]?.id).toBe("a");
    }
  });

  it("propagates context errors", async () => {
    h.ctxResult.value = { ok: false, error: { code: "NOT_FOUND", message: "no ws" } };
    const result = await getTasks();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("returns DB_ERROR on query failure", async () => {
    h.tableResult.value = { data: null, error: { message: "boom" } };
    const result = await getTasks();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});

describe("getTaskById", () => {
  it("returns the mapped task", async () => {
    h.tableResult.value = { data: makeRow("x"), error: null };
    const result = await getTaskById("x");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.id).toBe("x");
  });

  it("returns NOT_FOUND when missing", async () => {
    h.tableResult.value = { data: null, error: null };
    const result = await getTaskById("missing");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("returns DB_ERROR on lookup failure", async () => {
    h.tableResult.value = { data: null, error: { message: "lookup boom" } };
    const result = await getTaskById("x");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });

  it("propagates context errors", async () => {
    h.ctxResult.value = { ok: false, error: { code: "UNAUTHORIZED", message: "no" } };
    const result = await getTaskById("x");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNAUTHORIZED");
  });
});

describe("getTasksInRange", () => {
  it("maps rows in the range", async () => {
    h.tableResult.value = { data: [makeRow("r1")], error: null };
    const result = await getTasksInRange("2026-06-15", "2026-06-21");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value[0]?.id).toBe("r1");
  });

  it("returns DB_ERROR on failure", async () => {
    h.tableResult.value = { data: null, error: { message: "range boom" } };
    const result = await getTasksInRange("2026-06-15", "2026-06-21");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });

  it("propagates context errors", async () => {
    h.ctxResult.value = { ok: false, error: { code: "NOT_FOUND", message: "no ws" } };
    const result = await getTasksInRange("2026-06-15", "2026-06-21");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });
});
