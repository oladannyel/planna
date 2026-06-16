import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database";

type QuestionRow = Database["public"]["Tables"]["ethics_questions"]["Row"];

function makeRow(overrides: Partial<QuestionRow> = {}): QuestionRow {
  return {
    id: "q1",
    workspace_id: "ws-1",
    question: "Was I fair?",
    sort_order: 0,
    active: true,
    created_at: "2026-06-16T09:00:00.000Z",
    ...overrides,
  };
}

const h = vi.hoisted(() => {
  const ctxResult: { value: unknown } = { value: null };
  const rowResult: { value: { data: unknown; error: unknown } } = {
    value: { data: null, error: null },
  };
  const updateResult: { value: { error: unknown } } = { value: { error: null } };
  const insertArg = vi.fn();
  const updateArg = vi.fn();
  const upsertArg = vi.fn();

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    single: () => Promise.resolve(rowResult.value),
    then: (resolve: (v: unknown) => unknown) => resolve(updateResult.value),
    insert: (arg: unknown) => {
      insertArg(arg);
      return builder;
    },
    update: (arg: unknown) => {
      updateArg(arg);
      return builder;
    },
    upsert: (arg: unknown) => {
      upsertArg(arg);
      return builder;
    },
  };
  const supabase = { from: () => builder };
  return { ctxResult, rowResult, updateResult, insertArg, updateArg, upsertArg, supabase };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/workspace/queries", () => ({
  getAuthedContext: () => Promise.resolve(h.ctxResult.value),
}));

const { addQuestion, updateQuestion, deactivateQuestion, reorderQuestions, saveReflection } =
  await import("../actions");

beforeEach(() => {
  h.ctxResult.value = {
    ok: true,
    value: { supabase: h.supabase, userId: "u1", workspaceId: "ws-1" },
  };
  h.rowResult.value = { data: makeRow(), error: null };
  h.updateResult.value = { error: null };
  h.insertArg.mockReset();
  h.updateArg.mockReset();
  h.upsertArg.mockReset();
});

describe("addQuestion", () => {
  it("rejects an empty question before the DB", async () => {
    const result = await addQuestion("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(h.insertArg).not.toHaveBeenCalled();
  });

  it("propagates an unauthorized context", async () => {
    h.ctxResult.value = { ok: false, error: { code: "UNAUTHORIZED", message: "no" } };
    const result = await addQuestion("Valid?");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNAUTHORIZED");
  });

  it("inserts and returns the mapped question", async () => {
    const result = await addQuestion("Was I fair?");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.question).toBe("Was I fair?");
    const payload = h.insertArg.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.workspace_id).toBe("ws-1");
  });

  it("returns DB_ERROR on insert failure", async () => {
    h.rowResult.value = { data: null, error: { message: "boom" } };
    const result = await addQuestion("Valid?");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});

describe("updateQuestion", () => {
  it("validates then updates", async () => {
    const result = await updateQuestion("q1", "Updated?");
    expect(result.ok).toBe(true);
    expect(h.updateArg.mock.calls[0]?.[0]).toEqual({ question: "Updated?" });
  });

  it("rejects invalid input", async () => {
    const result = await updateQuestion("q1", "");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns DB_ERROR on update failure", async () => {
    h.rowResult.value = { data: null, error: { message: "boom" } };
    const result = await updateQuestion("q1", "Valid?");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});

describe("deactivateQuestion", () => {
  it("sets active false and returns the id", async () => {
    const result = await deactivateQuestion("q1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.id).toBe("q1");
    expect(h.updateArg.mock.calls[0]?.[0]).toEqual({ active: false });
  });

  it("returns DB_ERROR on failure", async () => {
    h.updateResult.value = { error: { message: "boom" } };
    const result = await deactivateQuestion("q1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});

describe("reorderQuestions", () => {
  it("updates sort_order for each id in order", async () => {
    const result = await reorderQuestions(["a", "b", "c"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.count).toBe(3);
    expect(h.updateArg.mock.calls.map((c) => c[0])).toEqual([
      { sort_order: 0 },
      { sort_order: 1 },
      { sort_order: 2 },
    ]);
  });

  it("stops with DB_ERROR if an update fails", async () => {
    h.updateResult.value = { error: { message: "boom" } };
    const result = await reorderQuestions(["a", "b"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});

describe("saveReflection", () => {
  const answers = [{ questionId: "q1", question: "Q?", answer: "A." }];

  it("rejects a malformed weekStart before the DB", async () => {
    const result = await saveReflection("06/15/2026", answers);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(h.upsertArg).not.toHaveBeenCalled();
  });

  it("upserts only ethics_answers (preserving narrative) and echoes the reflection", async () => {
    h.updateResult.value = { error: null };
    const result = await saveReflection("2026-06-15", answers);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.answers).toEqual(answers);
    const payload = h.upsertArg.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.week_start).toBe("2026-06-15");
    expect(payload.ethics_answers).toEqual(answers);
    expect("narrative" in payload).toBe(false);
  });

  it("returns DB_ERROR when the upsert fails", async () => {
    h.updateResult.value = { error: { message: "boom" } };
    const result = await saveReflection("2026-06-15", answers);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });

  it("propagates an unauthorized context", async () => {
    h.ctxResult.value = { ok: false, error: { code: "UNAUTHORIZED", message: "no" } };
    const result = await saveReflection("2026-06-15", answers);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNAUTHORIZED");
  });
});
