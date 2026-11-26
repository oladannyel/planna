import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const rows: { value: Record<string, unknown>[] } = { value: [] };
  const count: { value: number | null } = { value: 0 };
  const error: { value: unknown } = { value: null };
  const updates: Record<string, unknown>[] = [];
  const filters: { method: string; args: unknown[] }[] = [];
  const authed: { value: unknown } = { value: null };

  function builder(): Record<string, unknown> {
    const self: Record<string, unknown> = {};
    const record =
      (method: string) =>
      (...args: unknown[]) => {
        filters.push({ method, args });
        return self;
      };
    Object.assign(self, {
      select: record("select"),
      eq: record("eq"),
      is: record("is"),
      in: record("in"),
      order: record("order"),
      limit: () => Promise.resolve({ data: rows.value, error: error.value }),
      update: (arg: Record<string, unknown>) => {
        updates.push(arg);
        return self;
      },
      then: (resolve: (value: unknown) => unknown) =>
        resolve({ data: null, error: error.value, count: count.value }),
    });
    return self;
  }

  return { rows, count, error, updates, filters, authed, supabase: { from: () => builder() } };
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
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { listNotifications, unreadNotificationCount } = await import("../queries");
const { markNotificationsRead } = await import("../actions");

beforeEach(() => {
  h.rows.value = [];
  h.count.value = 0;
  h.error.value = null;
  h.updates.length = 0;
  h.filters.length = 0;
  h.authed.value = null;
});

describe("listNotifications", () => {
  it("maps rows to the bell's shape", async () => {
    h.rows.value = [
      {
        id: "n1",
        kind: "request_received",
        title: "New request from Ada",
        body: "Fix the export bug",
        request_id: "req-1",
        read_at: null,
        created_at: "2026-11-26T09:00:00.000Z",
      },
    ];

    const result = await listNotifications();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toEqual({
        id: "n1",
        kind: "request_received",
        title: "New request from Ada",
        body: "Fix the export bug",
        requestId: "req-1",
        readAt: null,
        createdAt: "2026-11-26T09:00:00.000Z",
      });
    }
  });

  it("surfaces a read failure", async () => {
    h.error.value = { message: "boom" };
    const result = await listNotifications();
    expect(result.ok).toBe(false);
  });
});

describe("unreadNotificationCount", () => {
  it("counts the unread ones", async () => {
    h.count.value = 4;
    expect(await unreadNotificationCount()).toBe(4);
  });

  /** The badge must never be the reason a page fails to render. */
  it("answers zero rather than failing the layout", async () => {
    h.error.value = { message: "boom" };
    expect(await unreadNotificationCount()).toBe(0);

    h.error.value = null;
    h.authed.value = { ok: false, error: { code: "UNAUTHORIZED", message: "no" } };
    expect(await unreadNotificationCount()).toBe(0);
  });
});

describe("markNotificationsRead", () => {
  it("marks every unread item in this workspace", async () => {
    h.count.value = 3;

    const result = await markNotificationsRead();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.updated).toBe(3);
    expect(h.updates[0]?.read_at).toBeTypeOf("string");
    expect(h.filters.some((f) => f.method === "in")).toBe(false);
  });

  /** Ids come straight from the client, so the write is scoped twice. */
  it("scopes an id list to the workspace and caps its length", async () => {
    await markNotificationsRead(Array.from({ length: 150 }, (_, i) => `n${i}`));

    const scoped = h.filters.find((f) => f.method === "eq");
    expect(scoped?.args).toEqual(["workspace_id", "ws-1"]);

    const inFilter = h.filters.find((f) => f.method === "in");
    expect((inFilter?.args[1] as string[]).length).toBe(100);
  });

  it("refuses an unauthenticated caller", async () => {
    h.authed.value = { ok: false, error: { code: "UNAUTHORIZED", message: "no" } };
    const result = await markNotificationsRead();
    expect(result.ok).toBe(false);
    expect(h.updates).toHaveLength(0);
  });
});
