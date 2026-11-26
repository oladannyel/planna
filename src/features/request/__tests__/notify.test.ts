import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const notificationInserts: Record<string, unknown>[] = [];
  const notificationError: { value: unknown } = { value: null };
  const queued: Record<string, unknown>[] = [];
  const queueResult: { value: unknown } = { value: { ok: true, value: { id: "mail-1" } } };

  function builder(): Record<string, unknown> {
    const self: Record<string, unknown> = {};
    Object.assign(self, {
      insert: (arg: Record<string, unknown>) => {
        notificationInserts.push(arg);
        return self;
      },
      then: (resolve: (value: unknown) => unknown) =>
        resolve({ data: null, error: notificationError.value }),
    });
    return self;
  }

  return {
    notificationInserts,
    notificationError,
    queued,
    queueResult,
    admin: { from: () => builder() },
  };
});

vi.mock("@/features/notifications/outbox", () => ({
  enqueueEmail: (_admin: unknown, message: Record<string, unknown>) => {
    h.queued.push(message);
    return Promise.resolve(h.queueResult.value);
  },
}));

const { notifyOwner, notifyRequester } = await import("../notify");

const request = {
  id: "req-1",
  workspaceId: "ws-1",
  requesterName: "Ada",
  requesterEmail: "ada@example.com",
  title: "Fix the export bug",
  description: "CSV export drops the last row.",
  urgency: "high" as const,
  desiredDeadline: null,
  state: "pending" as const,
  decidedAt: null,
  declineReason: null,
  taskId: null,
  token: "a".repeat(32),
  createdAt: "2026-11-26T09:00:00.000Z",
  updatedAt: "2026-11-26T09:00:00.000Z",
};

const owner = {
  workspaceId: "ws-1",
  ownerId: "owner-1",
  name: "Daniel",
  email: "daniel@example.com",
};

function context(overrides: Partial<Parameters<typeof notifyOwner>[0]> = {}) {
  return {
    admin: h.admin as never,
    request,
    owner,
    origin: "https://planna.test",
    ...overrides,
  };
}

beforeEach(() => {
  h.notificationInserts.length = 0;
  h.queued.length = 0;
  h.notificationError.value = null;
  h.queueResult.value = { ok: true, value: { id: "mail-1" } };
});

describe("notifyOwner", () => {
  it("writes a bell item and queues the owner's mail", async () => {
    await notifyOwner(context());

    expect(h.notificationInserts[0]).toMatchObject({
      workspace_id: "ws-1",
      kind: "request_received",
      request_id: "req-1",
    });
    expect(h.queued[0]).toMatchObject({ to: "daniel@example.com", requestId: "req-1" });
  });

  it("still writes the bell item when the owner has no address", async () => {
    await notifyOwner(context({ owner: { ...owner, email: null } }));
    expect(h.notificationInserts).toHaveLength(1);
    expect(h.queued).toHaveLength(0);
  });

  /** A request that was saved but not announced is still a request. */
  it("does not throw when the notification row fails", async () => {
    h.notificationError.value = { message: "boom" };
    await expect(notifyOwner(context())).resolves.toBeUndefined();
    expect(h.queued).toHaveLength(1);
  });

  it("does not throw when the mail cannot be queued", async () => {
    h.queueResult.value = { ok: false, error: { code: "DB_ERROR", message: "boom" } };
    await expect(notifyOwner(context())).resolves.toBeUndefined();
  });
});

describe("notifyRequester", () => {
  it("links the status page in every message", async () => {
    await notifyRequester(context(), { kind: "received" });
    expect(h.queued[0]?.text).toContain(`https://planna.test/request/status/${"a".repeat(32)}`);
  });

  it("sends one mail per decision", async () => {
    await notifyRequester(context(), { kind: "accepted" });
    await notifyRequester(context(), { kind: "rejected", reason: "No capacity" });
    await notifyRequester(context(), { kind: "progress", status: "done" });

    expect(h.queued.map((mail) => mail.subject)).toEqual([
      "Accepted: Fix the export bug",
      "Declined: Fix the export bug",
      "Done: Fix the export bug",
    ]);
  });

  /** The address is optional; the status page carries the same information. */
  it("sends nothing when no address was given", async () => {
    await notifyRequester(context({ request: { ...request, requesterEmail: null } }), {
      kind: "accepted",
    });
    expect(h.queued).toHaveLength(0);
  });

  it("sends nothing for a status with no wording", async () => {
    await notifyRequester(context(), { kind: "progress", status: "archived" });
    expect(h.queued).toHaveLength(0);
  });

  it("falls back to a neutral noun with no owner", async () => {
    await notifyRequester(context({ owner: null }), { kind: "accepted" });
    expect(h.queued[0]?.text).toContain("The owner accepted");
  });

  it("does not throw when the mail cannot be queued", async () => {
    h.queueResult.value = { ok: false, error: { code: "DB_ERROR", message: "boom" } };
    await expect(notifyRequester(context(), { kind: "accepted" })).resolves.toBeUndefined();
  });
});
