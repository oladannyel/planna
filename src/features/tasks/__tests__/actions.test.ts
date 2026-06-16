import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

function makeRow(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: "task-1",
    workspace_id: "ws-1",
    title: "Task",
    description: null,
    status: "todo",
    priority: "medium",
    tags: [],
    due_date: null,
    estimated_minutes: null,
    source: "manual",
    requested_by: null,
    carried_over: false,
    carry_count: 0,
    status_history: [],
    completed_at: null,
    created_at: "2026-06-16T09:00:00.000Z",
    updated_at: "2026-06-16T09:00:00.000Z",
    ...overrides,
  };
}

const h = vi.hoisted(() => {
  const tableResult: { value: { data: unknown; error: unknown } } = {
    value: { data: null, error: null },
  };
  const rpcResult: { value: { data: unknown; error: unknown } } = {
    value: { data: null, error: null },
  };
  const ctxResult: { value: unknown } = { value: null };

  const insertArg = vi.fn();
  const updateArg = vi.fn();
  const rpcArg = vi.fn();

  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "lte", "order", "delete"]) {
    builder[m] = () => builder;
  }
  builder.insert = (arg: unknown) => {
    insertArg(arg);
    return builder;
  };
  builder.update = (arg: unknown) => {
    updateArg(arg);
    return builder;
  };
  builder.single = () => Promise.resolve(tableResult.value);
  builder.maybeSingle = () => Promise.resolve(tableResult.value);
  builder.then = (resolve: (v: unknown) => unknown) => resolve(tableResult.value);

  const supabase = {
    from: () => builder,
    rpc: (name: string, args: unknown) => {
      rpcArg(name, args);
      return Promise.resolve(rpcResult.value);
    },
  };

  const parseResult: { value: unknown } = { value: null };

  return {
    tableResult,
    rpcResult,
    ctxResult,
    parseResult,
    insertArg,
    updateArg,
    rpcArg,
    supabase,
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/features/workspace/queries", () => ({
  getAuthedContext: () => Promise.resolve(h.ctxResult.value),
}));

vi.mock("../parser", () => ({
  parseTaskFromText: () => Promise.resolve(h.parseResult.value),
}));

const { createTask, updateTask, updateTaskStatus, deleteTask, createTaskFromText } =
  await import("../actions");

const okCtx = {
  ok: true,
  value: { supabase: h.supabase, userId: "user-1", workspaceId: "ws-1" },
};

beforeEach(() => {
  h.ctxResult.value = okCtx;
  h.tableResult.value = { data: null, error: null };
  h.rpcResult.value = { data: null, error: null };
  h.parseResult.value = null;
  h.insertArg.mockReset();
  h.updateArg.mockReset();
  h.rpcArg.mockReset();
});

describe("createTask", () => {
  it("rejects invalid input with VALIDATION_ERROR before touching the DB", async () => {
    const result = await createTask({ title: "", priority: "low", tags: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(h.insertArg).not.toHaveBeenCalled();
  });

  it("propagates an UNAUTHORIZED context error", async () => {
    h.ctxResult.value = { ok: false, error: { code: "UNAUTHORIZED", message: "no" } };
    const result = await createTask({ title: "Valid", priority: "low", tags: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNAUTHORIZED");
  });

  it("inserts and returns the mapped task", async () => {
    h.tableResult.value = { data: makeRow({ title: "Valid" }), error: null };
    const result = await createTask({
      title: "Valid",
      priority: "high",
      tags: ["x"],
      dueDate: "2026-07-01",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.title).toBe("Valid");
    const payload = h.insertArg.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.workspace_id).toBe("ws-1");
    expect(payload.source).toBe("manual");
    expect(payload.status_history).toHaveLength(1);
  });

  it("returns DB_ERROR when the insert fails", async () => {
    h.tableResult.value = { data: null, error: { message: "insert failed" } };
    const result = await createTask({ title: "Valid", priority: "low", tags: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });

  it("passes through all optional fields when provided", async () => {
    h.tableResult.value = { data: makeRow(), error: null };
    await createTask({
      title: "Full",
      description: "desc",
      priority: "low",
      tags: ["a"],
      dueDate: "2026-07-01",
      estimatedMinutes: 30,
    });
    const payload = h.insertArg.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.description).toBe("desc");
    expect(payload.due_date).toBe("2026-07-01");
    expect(payload.estimated_minutes).toBe(30);
  });

  it("defaults omitted optional fields to null", async () => {
    h.tableResult.value = { data: makeRow(), error: null };
    await createTask({ title: "Bare", priority: "low", tags: [] });
    const payload = h.insertArg.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.description).toBeNull();
    expect(payload.due_date).toBeNull();
    expect(payload.estimated_minutes).toBeNull();
  });
});

describe("updateTask", () => {
  it("builds a snake_case patch from provided fields only", async () => {
    h.tableResult.value = { data: makeRow({ priority: "urgent" }), error: null };
    const result = await updateTask("task-1", { priority: "urgent", dueDate: "2026-08-01" });
    expect(result.ok).toBe(true);
    const patch = h.updateArg.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(patch).toEqual({ priority: "urgent", due_date: "2026-08-01" });
    expect(patch.title).toBeUndefined();
  });

  it("maps every updatable field", async () => {
    h.tableResult.value = { data: makeRow(), error: null };
    await updateTask("task-1", {
      title: "New",
      description: "d",
      priority: "low",
      tags: ["t"],
      dueDate: "2026-09-01",
      estimatedMinutes: 15,
    });
    const patch = h.updateArg.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(patch).toEqual({
      title: "New",
      description: "d",
      priority: "low",
      tags: ["t"],
      due_date: "2026-09-01",
      estimated_minutes: 15,
    });
  });

  it("rejects invalid patch input", async () => {
    const result = await updateTask("task-1", { priority: "nope" as never });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns DB_ERROR when the update fails", async () => {
    h.tableResult.value = { data: null, error: { message: "update boom" } };
    const result = await updateTask("task-1", { title: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});

describe("updateTaskStatus", () => {
  it("appends history then sets completed_at when done", async () => {
    h.tableResult.value = {
      data: makeRow({ status: "done", completed_at: "2026-06-16T12:00:00.000Z" }),
      error: null,
    };
    const result = await updateTaskStatus("task-1", "done");
    expect(result.ok).toBe(true);
    expect(h.rpcArg).toHaveBeenCalledWith("append_status_history", expect.any(Object));
    const patch = h.updateArg.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(patch.status).toBe("done");
    expect(patch.completed_at).not.toBeNull();
  });

  it("clears completed_at when moving out of done", async () => {
    h.tableResult.value = { data: makeRow({ status: "todo" }), error: null };
    await updateTaskStatus("task-1", "todo");
    const patch = h.updateArg.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(patch.completed_at).toBeNull();
  });

  it("returns DB_ERROR if the history RPC fails", async () => {
    h.rpcResult.value = { data: null, error: { message: "rpc boom" } };
    const result = await updateTaskStatus("task-1", "done");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
    expect(h.updateArg).not.toHaveBeenCalled();
  });

  it("returns DB_ERROR if the row update fails after history append", async () => {
    h.rpcResult.value = { data: null, error: null };
    h.tableResult.value = { data: null, error: { message: "update boom" } };
    const result = await updateTaskStatus("task-1", "done");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
    expect(h.updateArg).toHaveBeenCalled();
  });
});

describe("deleteTask", () => {
  it("deletes and returns the id", async () => {
    h.tableResult.value = { data: null, error: null };
    const result = await deleteTask("task-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.id).toBe("task-1");
  });

  it("returns DB_ERROR when delete fails", async () => {
    h.tableResult.value = { data: null, error: { message: "nope" } };
    const result = await deleteTask("task-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});

describe("createTaskFromText", () => {
  it("parses then creates a task with ai_parsed source and returns confidence", async () => {
    h.parseResult.value = {
      ok: true,
      value: {
        title: "Parsed task",
        priority: "high",
        tags: ["ai"],
        dueDate: "2026-07-01",
        estimatedMinutes: 30,
        confidence: 0.77,
      },
    };
    h.tableResult.value = { data: makeRow({ title: "Parsed task" }), error: null };

    const result = await createTaskFromText("do the parsed task by next week");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.parsed.title).toBe("Parsed task");
      expect(result.value.confidence).toBe(0.77);
    }
    const payload = h.insertArg.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.source).toBe("ai_parsed");
  });

  it("propagates a parser error without creating", async () => {
    h.parseResult.value = { ok: false, error: { code: "AI_ERROR", message: "boom" } };
    const result = await createTaskFromText("garbled");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AI_ERROR");
    expect(h.insertArg).not.toHaveBeenCalled();
  });

  it("propagates a create failure after a successful parse", async () => {
    h.parseResult.value = {
      ok: true,
      value: {
        title: "Parsed task",
        priority: "low",
        tags: [],
        dueDate: null,
        estimatedMinutes: null,
        confidence: 0.5,
      },
    };
    h.tableResult.value = { data: null, error: { message: "insert failed" } };
    const result = await createTaskFromText("something");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});
