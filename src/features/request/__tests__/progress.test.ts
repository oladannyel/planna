import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const requestRow: { value: Record<string, unknown> | null } = { value: null };
  const readError: { value: unknown } = { value: null };
  const notified: unknown[] = [];
  const filters: { column: string; value: unknown }[] = [];

  function builder(): Record<string, unknown> {
    const self: Record<string, unknown> = {};
    Object.assign(self, {
      select: () => self,
      eq: (column: string, value: unknown) => {
        filters.push({ column, value });
        return self;
      },
      maybeSingle: () =>
        Promise.resolve(
          readError.value
            ? { data: null, error: readError.value }
            : { data: requestRow.value, error: null },
        ),
    });
    return self;
  }

  return {
    requestRow,
    readError,
    notified,
    filters,
    admin: { from: () => builder() },
  };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
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

const { notifyRequesterOfTaskStatus } = await import("../progress");

function accepted(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    workspace_id: "ws-1",
    requester_name: "Ada",
    requester_email: "ada@example.com",
    title: "Fix the export bug",
    description: "CSV export drops the last row.",
    urgency: "high",
    desired_deadline: null,
    state: "accepted",
    decided_at: "2026-11-26T09:30:00.000Z",
    decline_reason: null,
    task_id: "task-1",
    token: "a".repeat(32),
    created_at: "2026-11-26T09:00:00.000Z",
    updated_at: "2026-11-26T09:30:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  h.requestRow.value = accepted();
  h.readError.value = null;
  h.notified.length = 0;
  h.filters.length = 0;
});

describe("notifyRequesterOfTaskStatus", () => {
  it("tells the requester when their accepted task moves", async () => {
    await notifyRequesterOfTaskStatus("task-1", "in_progress");
    expect(h.notified).toEqual([{ kind: "progress", status: "in_progress" }]);
  });

  it("looks only at accepted requests for that task", async () => {
    await notifyRequesterOfTaskStatus("task-1", "done");
    expect(h.filters).toEqual([
      { column: "task_id", value: "task-1" },
      { column: "state", value: "accepted" },
    ]);
  });

  /** Most tasks have no request behind them; that must be silent. */
  it("does nothing for a task with no request", async () => {
    h.requestRow.value = null;
    await notifyRequesterOfTaskStatus("task-9", "done");
    expect(h.notified).toHaveLength(0);
  });

  it("does nothing when the requester left no address", async () => {
    h.requestRow.value = accepted({ requester_email: null });
    await notifyRequesterOfTaskStatus("task-1", "done");
    expect(h.notified).toHaveLength(0);
  });

  /**
   * The owner moved a card. Whatever happens here, the card moved — this is
   * called from `updateTaskStatus` and must never throw into it.
   */
  it("swallows a database failure", async () => {
    h.readError.value = { message: "boom" };
    await expect(notifyRequesterOfTaskStatus("task-1", "done")).resolves.toBeUndefined();
    expect(h.notified).toHaveLength(0);
  });
});
