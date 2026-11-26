import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const requestRow: { value: Record<string, unknown> | null } = { value: null };
  const loadError: { value: unknown } = { value: null };
  const updateError: { value: unknown } = { value: null };
  const createResult: { value: unknown } = {
    value: { ok: true, value: { id: "task-1", title: "Fix the CSV export" } },
  };
  const authed: { value: unknown } = { value: null };

  const updates: Record<string, unknown>[] = [];
  const createCalls: unknown[] = [];
  const notified: unknown[] = [];
  const parseCalled = vi.fn();
  const parseResult: { value: unknown } = {
    value: { ok: false, error: { code: "AI_ERROR", message: "down" } },
  };

  function builder(): Record<string, unknown> {
    const self: Record<string, unknown> = {};
    const chain = () => self;
    Object.assign(self, {
      select: chain,
      eq: chain,
      maybeSingle: () =>
        Promise.resolve(
          loadError.value
            ? { data: null, error: loadError.value }
            : { data: requestRow.value, error: null },
        ),
      update: (arg: Record<string, unknown>) => {
        updates.push(arg);
        return self;
      },
      then: (resolve: (value: unknown) => unknown) =>
        resolve({ data: null, error: updateError.value }),
    });
    return self;
  }

  const supabase = { from: () => builder() };

  return {
    requestRow,
    loadError,
    updateError,
    createResult,
    authed,
    updates,
    createCalls,
    notified,
    parseCalled,
    parseResult,
    supabase,
  };
});

vi.mock("@/features/workspace/queries", () => ({
  getAuthedContext: () =>
    Promise.resolve(
      h.authed.value ?? {
        ok: true,
        value: {
          supabase: h.supabase,
          userId: "owner-1",
          workspaceId: "ws-1",
          workspaceSlug: "demo",
        },
      },
    ),
}));
vi.mock("@/features/tasks/actions", () => ({
  createTask: (...args: unknown[]) => {
    h.createCalls.push(args);
    return Promise.resolve(h.createResult.value);
  },
}));
vi.mock("@/features/tasks/parser", () => ({
  parseTaskFromText: () => {
    h.parseCalled();
    return Promise.resolve(h.parseResult.value);
  },
}));
vi.mock("./../notify", () => ({
  notifyRequester: (_ctx: unknown, event: unknown) => {
    h.notified.push(event);
    return Promise.resolve();
  },
}));
vi.mock("./../owner", () => ({
  requestOwnerForWorkspace: () =>
    Promise.resolve({ workspaceId: "ws-1", ownerId: "owner-1", name: "Daniel", email: "d@test" }),
}));
vi.mock("./../link", () => ({ publicOrigin: () => Promise.resolve("https://planna.test") }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { acceptRequest, rejectRequest } = await import("../decide");

function pending(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    workspace_id: "ws-1",
    requester_name: "Ada",
    requester_email: "ada@example.com",
    title: "Fix the export bug",
    description: "CSV export drops the last row.",
    urgency: "high",
    desired_deadline: "2026-12-10",
    state: "pending",
    decided_at: null,
    decline_reason: null,
    task_id: null,
    token: "a".repeat(32),
    created_at: "2026-11-26T09:00:00.000Z",
    updated_at: "2026-11-26T09:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  h.requestRow.value = pending();
  h.loadError.value = null;
  h.updateError.value = null;
  h.authed.value = null;
  h.createResult.value = { ok: true, value: { id: "task-1", title: "Fix the CSV export" } };
  h.parseResult.value = { ok: false, error: { code: "AI_ERROR", message: "down" } };
  h.updates.length = 0;
  h.createCalls.length = 0;
  h.notified.length = 0;
  h.parseCalled.mockReset();
});

describe("acceptRequest", () => {
  it("parses the request, creates the task and links it", async () => {
    h.parseResult.value = {
      ok: true,
      value: {
        title: "Fix CSV export",
        priority: "urgent",
        tags: ["bug"],
        dueDate: "2026-12-01",
        estimatedMinutes: 90,
        confidence: 0.9,
      },
    };

    const result = await acceptRequest("req-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.taskId).toBe("task-1");

    const [input, source, options] = h.createCalls[0] as [
      Record<string, unknown>,
      string,
      Record<string, unknown>,
    ];
    expect(input.title).toBe("Fix CSV export");
    expect(input.priority).toBe("urgent");
    expect(input.dueDate).toBe("2026-12-01");
    expect(source).toBe("request_link");
    expect(options.requestedBy).toBe("Ada");

    expect(h.updates[0]).toMatchObject({ state: "accepted", task_id: "task-1" });
    expect(h.notified).toEqual([{ kind: "accepted" }]);
  });

  /**
   * The text is a stranger's and the model is a free tier. An outage must not
   * make the owner re-type a request they have already agreed to.
   */
  it("falls back to the submitted values when the model fails", async () => {
    await acceptRequest("req-1");

    const [input] = h.createCalls[0] as [Record<string, unknown>];
    expect(input.title).toBe("Fix the export bug");
    expect(input.priority).toBe("high");
    expect(input.dueDate).toBe("2026-12-10");
    expect(input.tags).toEqual([]);
  });

  it("is idempotent: a second accept returns the first task", async () => {
    h.requestRow.value = pending({ state: "accepted", task_id: "task-1" });

    const result = await acceptRequest("req-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.taskId).toBe("task-1");
    expect(h.createCalls).toHaveLength(0);
    expect(h.parseCalled).not.toHaveBeenCalled();
  });

  it("refuses to accept a request that was already declined", async () => {
    h.requestRow.value = pending({ state: "rejected" });

    const result = await acceptRequest("req-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(h.createCalls).toHaveLength(0);
  });

  it("reports a failure to link the task rather than claiming success", async () => {
    h.updateError.value = { message: "update boom" };

    const result = await acceptRequest("req-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});

describe("rejectRequest", () => {
  it("records the decision and sends the reason", async () => {
    const result = await rejectRequest("req-1", "  No capacity until March  ");

    expect(result.ok).toBe(true);
    expect(h.updates[0]).toMatchObject({
      state: "rejected",
      decline_reason: "No capacity until March",
    });
    expect(h.notified).toEqual([{ kind: "rejected", reason: "No capacity until March" }]);
    expect(h.createCalls).toHaveLength(0);
  });

  it("stores no reason when none was typed", async () => {
    await rejectRequest("req-1", "   ");
    expect(h.updates[0]).toMatchObject({ decline_reason: null });
  });

  it("is idempotent", async () => {
    h.requestRow.value = pending({ state: "rejected" });
    const result = await rejectRequest("req-1");
    expect(result.ok).toBe(true);
    expect(h.updates).toHaveLength(0);
  });

  it("refuses to decline something already accepted", async () => {
    h.requestRow.value = pending({ state: "accepted", task_id: "task-1" });
    const result = await rejectRequest("req-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });
});

/**
 * The authorisation matrix for both decisions. There is no id check in the
 * TypeScript: the scoping is RLS plus the explicit `workspace_id` filter, so
 * another owner's request reads back as absent rather than as forbidden.
 */
describe("authorisation", () => {
  it("refuses an anonymous caller", async () => {
    h.authed.value = { ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } };

    for (const result of [await acceptRequest("req-1"), await rejectRequest("req-1")]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("UNAUTHORIZED");
    }
    expect(h.createCalls).toHaveLength(0);
    expect(h.updates).toHaveLength(0);
  });

  it("cannot reach another workspace's request", async () => {
    // What the scoped read returns for an id that belongs to someone else.
    h.requestRow.value = null;

    for (const result of [await acceptRequest("req-1"), await rejectRequest("req-1")]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(h.createCalls).toHaveLength(0);
    expect(h.updates).toHaveLength(0);
  });

  it("surfaces a read failure as DB_ERROR", async () => {
    h.loadError.value = { message: "read boom" };
    const result = await acceptRequest("req-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});
