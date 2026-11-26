import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  /** Message ids already ingested, i.e. rows in `email_ingest_log`. */
  const logged = new Set<string>();
  const inserts: { table: string; arg: Record<string, unknown> }[] = [];
  const updates: Record<string, unknown>[] = [];
  const logInsertError: { value: unknown } = { value: null };
  const taskInsertError: { value: unknown } = { value: null };
  const connections: { value: Record<string, unknown>[] } = { value: [] };

  const sealedTokens = new Map<string, string>([["sealed-token", "refresh-token"]]);
  const refreshResult: { value: unknown } = { value: { ok: true, value: "access-token" } };
  const listResult: { value: unknown } = { value: { ok: true, value: [] as string[] } };
  const messages = new Map<string, { subject: string; from: string; body: string }>();
  const marked: { messageId: string; labelIds: string[] }[] = [];
  const parsed: { value: unknown } = {
    value: { ok: false, error: { code: "AI_ERROR", message: "down" } },
  };

  function builder(table: string): Record<string, unknown> {
    const filters: Record<string, unknown> = {};
    const self: Record<string, unknown> = {};
    Object.assign(self, {
      select: () => self,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        if (table === "email_connections" && column === "state") {
          return Promise.resolve({ data: connections.value, error: null });
        }
        return self;
      },
      insert: (arg: Record<string, unknown>) => {
        inserts.push({ table, arg });
        if (table === "email_ingest_log" && !logInsertError.value) {
          logged.add(String(arg.message_id));
        }
        return self;
      },
      update: (arg: Record<string, unknown>) => {
        updates.push({ table, ...arg });
        return self;
      },
      maybeSingle: () =>
        Promise.resolve({
          data:
            table === "email_ingest_log" && logged.has(String(filters.message_id))
              ? { message_id: filters.message_id }
              : null,
          error: null,
        }),
      single: () =>
        Promise.resolve(
          table === "tasks" && taskInsertError.value
            ? { data: null, error: taskInsertError.value }
            : { data: { id: "task-1" }, error: null },
        ),
      then: (resolve: (value: unknown) => unknown) =>
        resolve({
          data: null,
          error: table === "email_ingest_log" ? logInsertError.value : null,
        }),
    });
    return self;
  }

  return {
    logged,
    inserts,
    updates,
    logInsertError,
    taskInsertError,
    connections,
    sealedTokens,
    refreshResult,
    listResult,
    messages,
    marked,
    parsed,
    admin: { from: (table: string) => builder(table) },
  };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/lib/sealed", () => ({
  open: (value: string) => {
    const found = h.sealedTokens.get(value);
    if (!found) throw new Error("cannot open");
    return found;
  },
}));
vi.mock("../oauth", () => ({
  refreshAccessToken: () => Promise.resolve(h.refreshResult.value),
}));
vi.mock("../gmail", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    listMessageIds: () => Promise.resolve(h.listResult.value),
    getMessage: (_token: string, id: string) => {
      const message = h.messages.get(id);
      return Promise.resolve(
        message
          ? { ok: true, value: { id, receivedAt: null, ...message } }
          : { ok: false, error: { code: "DB_ERROR", message: "gone" } },
      );
    },
    labelIdByName: () => Promise.resolve({ ok: true, value: "Label_7" }),
    markHandled: (_token: string, messageId: string, labelIds: string[]) => {
      h.marked.push({ messageId, labelIds });
      return Promise.resolve({ ok: true, value: null });
    },
  };
});
vi.mock("@/features/tasks/parser", () => ({
  parseTaskFromText: () => Promise.resolve(h.parsed.value),
}));

const { pollConnection, pollAllMailboxes, messageToPrompt } = await import("../ingest");

const admin = h.admin as unknown as Parameters<typeof pollConnection>[0];
const connection = {
  workspace_id: "ws-1",
  refresh_token: "sealed-token",
  query: "label:plAnna",
};

function tasksCreated() {
  return h.inserts.filter((row) => row.table === "tasks");
}

beforeEach(() => {
  h.logged.clear();
  h.inserts.length = 0;
  h.updates.length = 0;
  h.marked.length = 0;
  h.messages.clear();
  h.logInsertError.value = null;
  h.taskInsertError.value = null;
  h.connections.value = [];
  h.refreshResult.value = { ok: true, value: "access-token" };
  h.listResult.value = { ok: true, value: [] };
  h.parsed.value = { ok: false, error: { code: "AI_ERROR", message: "down" } };
});

describe("messageToPrompt", () => {
  it("leads with the subject and truncates a long thread", () => {
    const prompt = messageToPrompt("Invoice", "x".repeat(5000));
    expect(prompt.startsWith("Invoice\n\n")).toBe(true);
    expect(prompt.length).toBeLessThan(2100);
  });

  it("drops an empty half rather than leaving blank lines", () => {
    expect(messageToPrompt("Invoice", "")).toBe("Invoice");
  });
});

describe("pollConnection", () => {
  it("turns each new message into a task and logs it", async () => {
    h.listResult.value = { ok: true, value: ["m1"] };
    h.messages.set("m1", {
      subject: "Send the invoice",
      from: "Ada <ada@example.com>",
      body: "By Friday please.",
    });

    const result = await pollConnection(admin, connection);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatchObject({ scanned: 1, created: 1, skipped: 0 });

    const [task] = tasksCreated();
    expect(task?.arg.title).toBe("Send the invoice");
    expect(task?.arg.source).toBe("email");
    expect(task?.arg.requested_by).toBe("Ada <ada@example.com>");
    expect(h.inserts.some((row) => row.table === "email_ingest_log")).toBe(true);
    expect(h.marked).toEqual([{ messageId: "m1", labelIds: ["Label_7"] }]);
  });

  it("prefers the parsed title, priority and deadline when the model answers", async () => {
    h.listResult.value = { ok: true, value: ["m1"] };
    h.messages.set("m1", { subject: "Invoice", from: "", body: "Friday" });
    h.parsed.value = {
      ok: true,
      value: {
        title: "Send the Q4 invoice",
        priority: "urgent",
        tags: ["finance"],
        dueDate: "2026-12-04",
        estimatedMinutes: 30,
        confidence: 0.9,
      },
    };

    await pollConnection(admin, connection);

    const [task] = tasksCreated();
    expect(task?.arg.title).toBe("Send the Q4 invoice");
    expect(task?.arg.priority).toBe("urgent");
    expect(task?.arg.due_date).toBe("2026-12-04");
    expect(task?.arg.tags).toEqual(["finance"]);
  });

  /**
   * The idempotency key is the log, not the label: the label removal is a
   * second call that can fail after the task exists.
   */
  it("creates no second task for a message it has already ingested", async () => {
    h.listResult.value = { ok: true, value: ["m1"] };
    h.messages.set("m1", { subject: "Invoice", from: "", body: "Body" });

    await pollConnection(admin, connection);
    const afterFirst = tasksCreated().length;
    await pollConnection(admin, connection);

    expect(tasksCreated()).toHaveLength(afterFirst);
    expect(afterFirst).toBe(1);
  });

  it("retries the label removal for a message it had already ingested", async () => {
    h.logged.add("m1");
    h.listResult.value = { ok: true, value: ["m1"] };

    const result = await pollConnection(admin, connection);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.skipped).toBe(1);
    expect(h.marked).toEqual([{ messageId: "m1", labelIds: ["Label_7"] }]);
  });

  it("skips a message with nothing in it", async () => {
    h.listResult.value = { ok: true, value: ["m1"] };
    h.messages.set("m1", { subject: "", from: "", body: "  " });

    const result = await pollConnection(admin, connection);

    expect(tasksCreated()).toHaveLength(0);
    if (result.ok) expect(result.value.skipped).toBe(1);
  });

  it("skips a message it cannot read, and keeps going", async () => {
    h.listResult.value = { ok: true, value: ["gone", "m2"] };
    h.messages.set("m2", { subject: "Second", from: "", body: "Body" });

    const result = await pollConnection(admin, connection);

    expect(tasksCreated()).toHaveLength(1);
    if (result.ok) expect(result.value).toMatchObject({ scanned: 2, created: 1, skipped: 1 });
  });

  it("records the poll time on the connection", async () => {
    await pollConnection(admin, connection);
    expect(h.updates[0]).toMatchObject({ table: "email_connections", state: "active" });
    expect(h.updates[0]?.last_polled_at).toBeTypeOf("string");
  });

  /** A revoked grant must land on the settings page, not retry silently. */
  it("marks the connection in error when Google refuses the refresh token", async () => {
    h.refreshResult.value = { ok: false, error: { code: "UNAUTHORIZED", message: "revoked" } };

    const result = await pollConnection(admin, connection);

    expect(result.ok).toBe(false);
    expect(h.updates[0]).toMatchObject({ state: "error", last_error: "revoked" });
    expect(tasksCreated()).toHaveLength(0);
  });

  it("marks the connection in error when the stored token cannot be opened", async () => {
    const result = await pollConnection(admin, { ...connection, refresh_token: "garbage" });

    expect(result.ok).toBe(false);
    expect(h.updates[0]).toMatchObject({ state: "error" });
  });

  it("marks the connection in error when the list call fails", async () => {
    h.listResult.value = { ok: false, error: { code: "DB_ERROR", message: "Gmail 500" } };

    const result = await pollConnection(admin, connection);

    expect(result.ok).toBe(false);
    expect(h.updates[0]).toMatchObject({ state: "error", last_error: "Gmail 500" });
  });
});

describe("pollAllMailboxes", () => {
  it("polls every active connection", async () => {
    h.connections.value = [connection, { ...connection, workspace_id: "ws-2" }];
    h.listResult.value = { ok: true, value: [] };

    const result = await pollAllMailboxes();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map((s) => s.workspaceId)).toEqual(["ws-1", "ws-2"]);
  });

  it("keeps going when one mailbox fails", async () => {
    h.connections.value = [{ ...connection, refresh_token: "garbage" }, connection];

    const result = await pollAllMailboxes();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map((s) => s.workspaceId)).toEqual(["ws-1"]);
  });
});
