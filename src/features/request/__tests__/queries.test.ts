import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const requestRows: { value: Record<string, unknown>[] } = { value: [] };
  const taskRows: { value: Record<string, unknown>[] } = { value: [] };
  const byToken: { value: Record<string, unknown> | null } = { value: null };
  const authed: { value: unknown } = { value: null };
  const tablesRead: string[] = [];

  function serverBuilder(table: string): Record<string, unknown> {
    const self: Record<string, unknown> = {};
    const chain = () => self;
    Object.assign(self, {
      select: chain,
      eq: chain,
      in: chain,
      is: chain,
      order: chain,
      limit: () =>
        Promise.resolve({
          data: table === "requests" ? requestRows.value : taskRows.value,
          error: null,
        }),
      then: (resolve: (value: unknown) => unknown) =>
        resolve({ data: table === "tasks" ? taskRows.value : requestRows.value, error: null }),
    });
    return self;
  }

  function adminBuilder(table: string): Record<string, unknown> {
    const self: Record<string, unknown> = {};
    const chain = () => self;
    tablesRead.push(table);
    Object.assign(self, {
      select: chain,
      eq: chain,
      maybeSingle: () =>
        Promise.resolve({
          data:
            table === "requests"
              ? byToken.value
              : table === "tasks"
                ? (taskRows.value[0] ?? null)
                : { id: "ws-1", name: "Daniel's workspace", owner_id: "owner-1" },
          error: null,
        }),
    });
    return self;
  }

  return {
    requestRows,
    taskRows,
    byToken,
    authed,
    tablesRead,
    supabase: { from: (table: string) => serverBuilder(table) },
    admin: {
      from: (table: string) => adminBuilder(table),
      auth: {
        admin: {
          getUserById: () =>
            Promise.resolve({
              data: {
                user: { email: "owner@example.com", user_metadata: { display_name: "Daniel" } },
              },
            }),
        },
      },
    },
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
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));

const { listRequests, listInboxRequests, requestStatusByToken } = await import("../queries");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    workspace_id: "ws-1",
    requester_name: "Ada",
    requester_email: "ada@example.com",
    title: "Fix the export bug",
    description: "CSV export drops the last row.",
    urgency: "high",
    desired_deadline: null,
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
  h.requestRows.value = [];
  h.taskRows.value = [];
  h.byToken.value = null;
  h.authed.value = null;
  h.tablesRead.length = 0;
});

describe("listRequests", () => {
  /** The inbox is a queue of decisions; decided rows are history. */
  it("puts everything pending first", async () => {
    h.requestRows.value = [
      row({ id: "a", state: "accepted" }),
      row({ id: "b", state: "pending" }),
      row({ id: "c", state: "rejected" }),
      row({ id: "d", state: "pending" }),
    ];

    const result = await listRequests();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map((r) => r.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("passes an unauthenticated caller straight through", async () => {
    h.authed.value = { ok: false, error: { code: "UNAUTHORIZED", message: "no" } };
    const result = await listRequests();
    expect(result.ok).toBe(false);
  });
});

describe("listInboxRequests", () => {
  it("attaches the task status of an accepted request", async () => {
    h.requestRows.value = [
      row({ id: "a", state: "accepted", task_id: "task-1" }),
      row({ id: "b", state: "pending" }),
    ];
    h.taskRows.value = [{ id: "task-1", status: "in_progress" }];

    const result = await listInboxRequests();

    expect(result.ok).toBe(true);
    if (result.ok) {
      const byId = Object.fromEntries(result.value.map((r) => [r.id, r.taskStatus]));
      expect(byId).toEqual({ a: "in_progress", b: null });
    }
  });

  it("does not query tasks when nothing has been accepted", async () => {
    h.requestRows.value = [row()];
    const result = await listInboxRequests();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value[0]?.taskStatus).toBeNull();
  });
});

describe("requestStatusByToken", () => {
  /** The token is the authorisation, so a malformed one must cost nothing. */
  it("rejects a token of the wrong shape without touching the database", async () => {
    expect(await requestStatusByToken("not-a-token")).toBeNull();
    expect(await requestStatusByToken("A".repeat(32))).toBeNull();
    expect(h.tablesRead).toHaveLength(0);
  });

  it("returns the request and its task status", async () => {
    h.byToken.value = row({
      state: "accepted",
      task_id: "task-1",
      decided_at: "2026-11-26T10:00:00.000Z",
    });
    h.taskRows.value = [{ status: "done", completed_at: "2026-11-26T12:00:00.000Z" }];

    const view = await requestStatusByToken("a".repeat(32));

    expect(view).toMatchObject({
      title: "Fix the export bug",
      state: "accepted",
      taskStatus: "done",
      ownerName: "Daniel",
      completedAt: "2026-11-26T12:00:00.000Z",
    });
  });

  /**
   * The link may be forwarded. It must reveal no more than the person who
   * filed the request already knew — notably not their address back to a
   * stranger, and not the owner's.
   */
  it("exposes no email addresses or internal ids", async () => {
    h.byToken.value = row();
    const view = await requestStatusByToken("a".repeat(32));
    const serialised = JSON.stringify(view);

    expect(serialised).not.toContain("ada@example.com");
    expect(serialised).not.toContain("owner@example.com");
    expect(serialised).not.toContain("ws-1");
    expect(serialised).not.toContain("a".repeat(32));
  });

  it("returns null for an unknown token", async () => {
    h.byToken.value = null;
    expect(await requestStatusByToken("b".repeat(32))).toBeNull();
  });
});
