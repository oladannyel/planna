import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const ctxResult: { value: unknown } = { value: null };
  const listResult: { value: { data: unknown; error: unknown } } = {
    value: { data: [], error: null },
  };
  const singleResult: { value: { data: unknown; error: unknown } } = {
    value: { data: null, error: null },
  };

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    not: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve(singleResult.value),
    then: (resolve: (v: unknown) => unknown) => resolve(listResult.value),
  };
  const supabase = { from: () => builder };
  return { ctxResult, listResult, singleResult, supabase };
});

vi.mock("@/features/workspace/queries", () => ({
  getAuthedContext: () => Promise.resolve(h.ctxResult.value),
}));

const { getActiveQuestions, getAllQuestions, getReflection, getReflectionHistory } =
  await import("../queries");

function questionRow(id: string, active = true) {
  return {
    id,
    workspace_id: "ws-1",
    question: `Q ${id}`,
    sort_order: 0,
    active,
    created_at: "2026-06-16T09:00:00.000Z",
  };
}

beforeEach(() => {
  h.ctxResult.value = {
    ok: true,
    value: { supabase: h.supabase, userId: "u1", workspaceId: "ws-1" },
  };
  h.listResult.value = { data: [], error: null };
  h.singleResult.value = { data: null, error: null };
});

describe("getActiveQuestions / getAllQuestions", () => {
  it("maps question rows", async () => {
    h.listResult.value = { data: [questionRow("a"), questionRow("b")], error: null };
    const result = await getActiveQuestions();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map((q) => q.id)).toEqual(["a", "b"]);
  });

  it("propagates context errors", async () => {
    h.ctxResult.value = { ok: false, error: { code: "UNAUTHORIZED", message: "no" } };
    const result = await getAllQuestions();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNAUTHORIZED");
  });

  it("returns DB_ERROR on failure", async () => {
    h.listResult.value = { data: null, error: { message: "boom" } };
    const result = await getAllQuestions();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});

describe("getReflection", () => {
  it("returns null when no row or no answers", async () => {
    h.singleResult.value = { data: null, error: null };
    expect((await getReflection("2026-06-15")).ok).toBe(true);

    h.singleResult.value = {
      data: { week_start: "2026-06-15", ethics_answers: null },
      error: null,
    };
    const result = await getReflection("2026-06-15");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it("returns parsed answers when present", async () => {
    h.singleResult.value = {
      data: {
        week_start: "2026-06-15",
        ethics_answers: [{ questionId: "q1", question: "Q?", answer: "A." }],
      },
      error: null,
    };
    const result = await getReflection("2026-06-15");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.answers[0]?.answer).toBe("A.");
  });

  it("returns DB_ERROR on failure", async () => {
    h.singleResult.value = { data: null, error: { message: "boom" } };
    const result = await getReflection("2026-06-15");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});

describe("getReflectionHistory", () => {
  it("maps weeks with reflections", async () => {
    h.listResult.value = {
      data: [{ week_start: "2026-06-15", ethics_answers: [] }],
      error: null,
    };
    const result = await getReflectionHistory();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value[0]?.weekStart).toBe("2026-06-15");
  });

  it("returns DB_ERROR on failure", async () => {
    h.listResult.value = { data: null, error: { message: "boom" } };
    const result = await getReflectionHistory();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});
