import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const updates: Record<string, unknown>[] = [];
  const inserted: Record<string, unknown>[] = [];
  const insertError: { value: unknown } = { value: null };
  const pending: { value: unknown[] } = { value: [] };
  const sendResults: { value: unknown[] } = { value: [] };
  const sendCalls: unknown[] = [];

  function builder(table: string): Record<string, unknown> {
    const self: Record<string, unknown> = {};
    const chain = () => self;
    Object.assign(self, {
      select: chain,
      eq: chain,
      lt: chain,
      order: chain,
      limit: () => Promise.resolve({ data: pending.value, error: null }),
      insert: (arg: Record<string, unknown>) => {
        inserted.push({ table, ...arg });
        return self;
      },
      update: (arg: Record<string, unknown>) => {
        updates.push(arg);
        return self;
      },
      single: () =>
        Promise.resolve(
          insertError.value
            ? { data: null, error: insertError.value }
            : { data: { id: "mail-1" }, error: null },
        ),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: null, error: null }),
    });
    return self;
  }

  return {
    updates,
    inserted,
    insertError,
    pending,
    sendResults,
    sendCalls,
    admin: { from: (table: string) => builder(table) },
  };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/lib/email/transport", () => ({
  sendEmail: (message: unknown) => {
    h.sendCalls.push(message);
    const next = h.sendResults.value.shift();
    return Promise.resolve(next ?? { ok: true, value: { id: "sent" } });
  },
}));

const { enqueueEmail, drainOutbox, attemptSend, MAX_SEND_ATTEMPTS } = await import("../outbox");

const admin = h.admin as unknown as Parameters<typeof enqueueEmail>[0];

const message = {
  to: "ada@example.com",
  subject: "New request",
  text: "Body",
  workspaceId: "ws-1",
  requestId: "req-1",
};

function row(attempts = 0) {
  return {
    id: "mail-1",
    to_email: "ada@example.com",
    subject: "New request",
    body_text: "Body",
    body_html: null,
    attempts,
  };
}

beforeEach(() => {
  h.updates.length = 0;
  h.inserted.length = 0;
  h.sendCalls.length = 0;
  h.insertError.value = null;
  h.pending.value = [];
  h.sendResults.value = [];
});

describe("enqueueEmail", () => {
  /**
   * The row is written before the send. Sending first loses the mail on any
   * crash in between, and silence is this feature's worst failure.
   */
  it("records the mail before attempting delivery", async () => {
    const result = await enqueueEmail(admin, message);

    expect(result.ok).toBe(true);
    expect(h.inserted[0]).toMatchObject({
      table: "email_outbox",
      to_email: "ada@example.com",
      request_id: "req-1",
      workspace_id: "ws-1",
    });
    expect(h.sendCalls).toHaveLength(1);
    expect(h.updates[0]).toMatchObject({ state: "sent", attempts: 1 });
  });

  it("does not attempt a send when the row could not be written", async () => {
    h.insertError.value = { message: "boom" };
    const result = await enqueueEmail(admin, message);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
    expect(h.sendCalls).toHaveLength(0);
  });
});

describe("attemptSend", () => {
  it("leaves a retryable failure pending, with the attempt counted", async () => {
    h.sendResults.value = [{ ok: false, error: { message: "429 slow down", retryable: true } }];

    const delivered = await attemptSend(admin, row());

    expect(delivered).toBe(false);
    expect(h.updates[0]).toMatchObject({ state: "pending", attempts: 1 });
  });

  it("marks a permanent failure failed immediately", async () => {
    h.sendResults.value = [{ ok: false, error: { message: "422 bad address", retryable: false } }];

    await attemptSend(admin, row());

    expect(h.updates[0]).toMatchObject({ state: "failed", attempts: 1 });
  });

  /** Otherwise a provider that is down forever retries forever. */
  it("gives up once the attempt cap is reached", async () => {
    h.sendResults.value = [{ ok: false, error: { message: "500", retryable: true } }];

    await attemptSend(admin, row(MAX_SEND_ATTEMPTS - 1));

    expect(h.updates[0]).toMatchObject({ state: "failed", attempts: MAX_SEND_ATTEMPTS });
  });

  it("records the send time on success", async () => {
    await attemptSend(admin, row(2));
    expect(h.updates[0]).toMatchObject({ state: "sent", attempts: 3, last_error: null });
    expect(h.updates[0]?.sent_at).toBeTypeOf("string");
  });
});

describe("drainOutbox", () => {
  it("retries each pending row and reports what went out", async () => {
    h.pending.value = [row(1), { ...row(1), id: "mail-2" }];
    h.sendResults.value = [
      { ok: true, value: { id: "x" } },
      { ok: false, error: { message: "500", retryable: true } },
    ];

    const result = await drainOutbox();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ attempted: 2, sent: 1 });
  });

  it("does nothing when the backlog is empty", async () => {
    const result = await drainOutbox();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ attempted: 0, sent: 0 });
    expect(h.sendCalls).toHaveLength(0);
  });
});
