import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestInputSchema } from "@/features/tasks/schema";

const h = vi.hoisted(() => {
  const wsResult: { value: { data: unknown; error: unknown } } = {
    value: { data: { id: "ws-1", name: "Ada's workspace", owner_id: "owner-1" }, error: null },
  };
  const requestInsertResult: { value: { data: unknown; error: unknown } } = {
    value: {
      data: {
        id: "req-1",
        workspace_id: "ws-1",
        requester_name: "Ada",
        requester_email: null,
        title: "Fix the export bug",
        description: "CSV export drops the last row for large datasets.",
        urgency: "high",
        desired_deadline: "2026-06-30",
        state: "pending",
        decided_at: null,
        decline_reason: null,
        task_id: null,
        token: "a".repeat(32),
        created_at: "2026-11-26T09:00:00.000Z",
        updated_at: "2026-11-26T09:00:00.000Z",
      },
      error: null,
    },
  };

  const inserts: { table: string; arg: Record<string, unknown> }[] = [];
  const parseCalled = vi.fn();
  const sent = vi.fn();

  /**
   * Stands in for `claim_request_slot`. The real function increments and tests
   * a counter in one statement; this models it as a per-bucket counter so a
   * test can assert on call *order* and on which bucket was charged.
   */
  const rpcCalls: { bucket: string; limit: number }[] = [];
  const hits = new Map<string, number>();
  const rpcError: { value: unknown } = { value: null };
  const rpcReturnsNull = { value: false };

  const rpc = vi.fn((fn: string, args: { p_bucket: string; p_limit: number }) => {
    if (fn !== "claim_request_slot") throw new Error(`unexpected rpc: ${fn}`);
    rpcCalls.push({ bucket: args.p_bucket, limit: args.p_limit });
    if (rpcError.value) return Promise.resolve({ data: null, error: rpcError.value });
    if (rpcReturnsNull.value) return Promise.resolve({ data: null, error: null });

    const next = (hits.get(args.p_bucket) ?? 0) + 1;
    hits.set(args.p_bucket, next);
    return Promise.resolve({ data: next <= args.p_limit, error: null });
  });

  /** A per-table query builder: every table the ingest path touches. */
  function makeBuilder(table: string) {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    Object.assign(builder, {
      select: chain,
      eq: chain,
      in: chain,
      is: chain,
      lt: chain,
      order: chain,
      limit: chain,
      insert: (arg: Record<string, unknown>) => {
        inserts.push({ table, arg });
        return builder;
      },
      update: () => builder,
      maybeSingle: () =>
        Promise.resolve(table === "workspaces" ? wsResult.value : { data: null, error: null }),
      single: () =>
        Promise.resolve(
          table === "requests"
            ? requestInsertResult.value
            : { data: { id: `${table}-row` }, error: null },
        ),
      // Awaited directly (the notification insert does not select).
      then: (resolve: (value: unknown) => unknown) => resolve({ data: null, error: null }),
    });
    return builder;
  }

  const admin = {
    from: (table: string) => makeBuilder(table),
    rpc,
    auth: {
      admin: {
        getUserById: () =>
          Promise.resolve({
            data: { user: { email: "owner@example.com", user_metadata: { display_name: "Ada" } } },
          }),
      },
    },
  };

  return {
    wsResult,
    requestInsertResult,
    inserts,
    parseCalled,
    sent,
    admin,
    rpc,
    rpcCalls,
    hits,
    rpcError,
    rpcReturnsNull,
  };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/features/tasks/parser", () => ({
  parseTaskFromText: () => {
    h.parseCalled();
    return Promise.resolve({ ok: false, error: { code: "AI_ERROR", message: "x" } });
  },
}));
vi.mock("@/lib/email/transport", () => ({
  sendEmail: (message: unknown) => {
    h.sent(message);
    return Promise.resolve({ ok: true, value: { id: "mail-1" } });
  },
  emailConfigured: () => true,
}));
vi.mock("@/lib/env", () => ({
  env: { SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key" },
}));

const { ingestRequest, REQUEST_HOURLY_LIMIT, REQUEST_IP_HOURLY_LIMIT } = await import("../ingest");

const input: RequestInputSchema = {
  slug: "demo",
  requesterName: "Ada",
  title: "Fix the export bug",
  description: "CSV export drops the last row for large datasets.",
  urgency: "high",
  desiredDeadline: "2026-06-30",
};

const ORIGIN = "https://planna.test";

/** The row a successful insert returns, rebuilt per test. */
function pendingRow(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: "req-1",
      workspace_id: "ws-1",
      requester_name: "Ada",
      requester_email: null,
      title: "Fix the export bug",
      description: "CSV export drops the last row for large datasets.",
      urgency: "high",
      desired_deadline: "2026-06-30",
      state: "pending",
      decided_at: null,
      decline_reason: null,
      task_id: null,
      token: "a".repeat(32),
      created_at: "2026-11-26T09:00:00.000Z",
      updated_at: "2026-11-26T09:00:00.000Z",
      ...overrides,
    },
    error: null,
  };
}

/** Each test gets a fresh address, so one test's quota is not another's. */
let addressCounter = 0;
function freshContext() {
  addressCounter += 1;
  return { address: `203.0.113.${addressCounter}`, origin: ORIGIN };
}

function insertsInto(table: string) {
  return h.inserts.filter((row) => row.table === table);
}

beforeEach(() => {
  h.wsResult.value = {
    data: { id: "ws-1", name: "Ada's workspace", owner_id: "owner-1" },
    error: null,
  };
  h.requestInsertResult.value = pendingRow();
  h.inserts.length = 0;
  h.parseCalled.mockReset();
  h.sent.mockReset();
  h.rpc.mockClear();
  h.rpcCalls.length = 0;
  h.hits.clear();
  h.rpcError.value = null;
  h.rpcReturnsNull.value = false;
});

describe("ingestRequest", () => {
  it("records a pending request, not a task", async () => {
    const result = await ingestRequest(input, freshContext());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.requestId).toBe("req-1");
      expect(result.value.statusUrl).toBe(`${ORIGIN}/request/status/${"a".repeat(32)}`);
    }

    expect(insertsInto("tasks")).toHaveLength(0);
    const [request] = insertsInto("requests");
    expect(request?.arg.workspace_id).toBe("ws-1");
    expect(request?.arg.title).toBe("Fix the export bug");
    expect(request?.arg.requester_name).toBe("Ada");
    expect(request?.arg.urgency).toBe("high");
    expect(request?.arg.desired_deadline).toBe("2026-06-30");
  });

  /**
   * The point of ADR 0001: the model call used to sit in front of an
   * unauthenticated endpoint. A submission must now cost a row and nothing
   * else.
   */
  it("never calls the model", async () => {
    await ingestRequest(input, freshContext());
    expect(h.parseCalled).not.toHaveBeenCalled();
  });

  it("mints a distinct 128-bit token per request", async () => {
    await ingestRequest(input, freshContext());
    await ingestRequest(input, freshContext());

    const tokens = insertsInto("requests").map((row) => row.arg.token as string);
    expect(tokens).toHaveLength(2);
    for (const token of tokens) expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(tokens[0]).not.toBe(tokens[1]);
  });

  it("notifies the owner in-app and by email", async () => {
    await ingestRequest(input, freshContext());

    const [notification] = insertsInto("notifications");
    expect(notification?.arg.kind).toBe("request_received");
    expect(notification?.arg.workspace_id).toBe("ws-1");
    expect(notification?.arg.title).toContain("Ada");

    const mail = insertsInto("email_outbox");
    expect(mail).toHaveLength(1);
    expect(mail[0]?.arg.to_email).toBe("owner@example.com");
  });

  it("acknowledges the requester only when they gave an address", async () => {
    await ingestRequest(input, freshContext());
    expect(insertsInto("email_outbox")).toHaveLength(1);

    h.inserts.length = 0;
    h.requestInsertResult.value = pendingRow({ requester_email: "ada@example.com" });

    await ingestRequest({ ...input, requesterEmail: "ada@example.com" }, freshContext());
    const recipients = insertsInto("email_outbox").map((row) => row.arg.to_email);
    expect(recipients).toEqual(["owner@example.com", "ada@example.com"]);
  });

  it("returns NOT_FOUND for an unknown slug", async () => {
    h.wsResult.value = { data: null, error: null };
    const result = await ingestRequest(input, freshContext());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    expect(insertsInto("requests")).toHaveLength(0);
  });

  it("returns DB_ERROR when the insert fails", async () => {
    h.requestInsertResult.value = { data: null, error: { message: "insert boom" } };
    const result = await ingestRequest(input, freshContext());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});

/**
 * Request links are unauthenticated by design, so this is the only path where
 * a stranger can make the workspace owner spend anything.
 */
describe("ingestRequest workspace throttling", () => {
  it("accepts submissions up to the hourly limit", async () => {
    h.hits.set("ws:ws-1", REQUEST_HOURLY_LIMIT - 1);
    const result = await ingestRequest(input, freshContext());
    expect(result.ok).toBe(true);
  });

  it("rejects a submission once the workspace is at its hourly limit", async () => {
    h.hits.set("ws:ws-1", REQUEST_HOURLY_LIMIT);
    const result = await ingestRequest(input, freshContext());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("RATE_LIMIT");
  });

  it("refuses before writing anything", async () => {
    h.hits.set("ws:ws-1", REQUEST_HOURLY_LIMIT);
    await ingestRequest(input, freshContext());
    expect(h.inserts).toHaveLength(0);
  });

  /**
   * The regression migration 0007 exists for. The previous implementation read
   * a count and then inserted, so submissions issued together all observed the
   * same pre-insert count and all passed the limit. Driving the claims
   * concurrently is the only shape that distinguishes an atomic counter from a
   * read-then-write one.
   */
  it("holds the cap when submissions arrive concurrently", async () => {
    const burst = Array.from({ length: REQUEST_HOURLY_LIMIT + 15 }, () =>
      ingestRequest(input, { address: "198.51.100.9", origin: ORIGIN }),
    );
    const results = await Promise.all(burst);

    const accepted = results.filter((r) => r.ok).length;
    // The address cap is the tighter of the two and bites first, which is
    // itself the point: no single caller gets the whole workspace quota.
    expect(accepted).toBe(REQUEST_IP_HOURLY_LIMIT);
    expect(insertsInto("requests")).toHaveLength(REQUEST_IP_HOURLY_LIMIT);
  });

  it("surfaces a throttle failure rather than failing open", async () => {
    h.rpcError.value = { message: "counter down" };
    const result = await ingestRequest(input, freshContext());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
    expect(h.inserts).toHaveLength(0);
  });

  it("refuses when the throttle answers neither yes nor no", async () => {
    h.rpcReturnsNull.value = true;
    const result = await ingestRequest(input, freshContext());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("RATE_LIMIT");
    expect(h.inserts).toHaveLength(0);
  });
});

/**
 * An unknown slug used to be answered before anything was counted, which made
 * the 404 a free existence oracle over every workspace in the deployment.
 */
describe("ingestRequest address throttling", () => {
  it("charges the address before the slug is looked up", async () => {
    h.wsResult.value = { data: null, error: null };
    await ingestRequest(input, { address: "203.0.113.200", origin: ORIGIN });

    expect(h.rpcCalls).toHaveLength(1);
    expect(h.rpcCalls[0]?.bucket).toMatch(/^ip:/);
    expect(h.rpcCalls[0]?.limit).toBe(REQUEST_IP_HOURLY_LIMIT);
  });

  it("throttles slug probing, so enumeration costs quota", async () => {
    const address = "203.0.113.201";
    h.wsResult.value = { data: null, error: null };

    const codes: string[] = [];
    for (let i = 0; i < REQUEST_IP_HOURLY_LIMIT + 3; i += 1) {
      const result = await ingestRequest(
        { ...input, slug: `guess-${i}` },
        { address, origin: ORIGIN },
      );
      if (!result.ok) codes.push(result.error.code);
    }

    expect(codes.filter((c) => c === "NOT_FOUND")).toHaveLength(REQUEST_IP_HOURLY_LIMIT);
    expect(codes.filter((c) => c === "RATE_LIMIT")).toHaveLength(3);
  });

  it("claims in order: address, then workspace", async () => {
    await ingestRequest(input, { address: "203.0.113.202", origin: ORIGIN });
    expect(h.rpcCalls.map((c) => c.bucket.split(":")[0])).toEqual(["ip", "ws"]);
  });

  it("does not let one address spend another's quota", async () => {
    h.hits.set("ws:ws-1", 0);
    const a = await ingestRequest(input, { address: "203.0.113.210", origin: ORIGIN });
    const b = await ingestRequest(input, { address: "203.0.113.211", origin: ORIGIN });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(h.hits.get("ws:ws-1")).toBe(2);
  });

  it("puts requests with no usable address in one shared bucket", async () => {
    const first = await ingestRequest(input, { address: null, origin: ORIGIN });
    expect(first.ok).toBe(true);
    expect(h.rpcCalls[0]?.bucket).toBe("ip:unknown");
  });
});
