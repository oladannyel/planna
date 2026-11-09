import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestInputSchema } from "@/features/tasks/schema";

const h = vi.hoisted(() => {
  const wsResult: { value: { data: unknown; error: unknown } } = {
    value: { data: { id: "ws-1" }, error: null },
  };
  const insertResult: { value: { data: unknown; error: unknown } } = {
    value: { data: { id: "task-99" }, error: null },
  };
  const parseResult: { value: unknown } = { value: { ok: false, error: {} } };
  const insertArg = vi.fn();
  const parseCalled = vi.fn();

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

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(wsResult.value),
    single: () => Promise.resolve(insertResult.value),
    insert: (arg: unknown) => {
      insertArg(arg);
      return builder;
    },
  };

  const admin = { from: () => builder, rpc };
  return {
    wsResult,
    insertResult,
    parseResult,
    insertArg,
    parseCalled,
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
    return Promise.resolve(h.parseResult.value);
  },
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

/** Each test gets a fresh address, so one test's quota is not another's. */
let addressCounter = 0;
function freshContext() {
  addressCounter += 1;
  return { address: `203.0.113.${addressCounter}` };
}

beforeEach(() => {
  h.wsResult.value = { data: { id: "ws-1" }, error: null };
  h.insertResult.value = { data: { id: "task-99" }, error: null };
  h.parseResult.value = { ok: false, error: { code: "AI_ERROR", message: "x" } };
  h.insertArg.mockReset();
  h.parseCalled.mockReset();
  h.rpc.mockClear();
  h.rpcCalls.length = 0;
  h.hits.clear();
  h.rpcError.value = null;
  h.rpcReturnsNull.value = false;
});

describe("ingestRequest", () => {
  it("returns NOT_FOUND for an unknown slug", async () => {
    h.wsResult.value = { data: null, error: null };
    const result = await ingestRequest(input, freshContext());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    expect(h.insertArg).not.toHaveBeenCalled();
  });

  it("returns DB_ERROR when the workspace lookup fails", async () => {
    h.wsResult.value = { data: null, error: { message: "boom" } };
    const result = await ingestRequest(input, freshContext());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });

  it("uses AI-enriched values when parsing succeeds", async () => {
    h.parseResult.value = {
      ok: true,
      value: {
        title: "Fix CSV export",
        priority: "urgent",
        tags: ["bug", "export"],
        dueDate: "2026-06-25",
        estimatedMinutes: 60,
        confidence: 0.8,
      },
    };
    const result = await ingestRequest(input, freshContext());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.taskId).toBe("task-99");

    const payload = h.insertArg.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.title).toBe("Fix CSV export");
    expect(payload.priority).toBe("urgent");
    expect(payload.tags).toEqual(["bug", "export"]);
    expect(payload.due_date).toBe("2026-06-25");
    expect(payload.source).toBe("request_link");
    expect(payload.requested_by).toBe("Ada");
  });

  it("falls back to submitted values when parsing fails", async () => {
    h.parseResult.value = { ok: false, error: { code: "AI_ERROR", message: "x" } };
    const result = await ingestRequest(input, freshContext());
    expect(result.ok).toBe(true);

    const payload = h.insertArg.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.title).toBe("Fix the export bug");
    expect(payload.priority).toBe("high");
    expect(payload.tags).toEqual([]);
    expect(payload.due_date).toBe("2026-06-30");
  });

  it("returns DB_ERROR when the insert fails", async () => {
    h.insertResult.value = { data: null, error: { message: "insert boom" } };
    const result = await ingestRequest(input, freshContext());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });
});

/**
 * Request links are unauthenticated by design, so this is the only path where
 * a stranger can make the workspace owner spend money.
 */
describe("ingestRequest workspace throttling", () => {
  it("accepts submissions up to the hourly limit", async () => {
    const context = { address: "198.51.100.7" };
    h.hits.set(`ws:ws-1`, REQUEST_HOURLY_LIMIT - 1);
    const result = await ingestRequest(input, context);
    expect(result.ok).toBe(true);
  });

  it("rejects a submission once the workspace is at its hourly limit", async () => {
    h.hits.set(`ws:ws-1`, REQUEST_HOURLY_LIMIT);
    const result = await ingestRequest(input, freshContext());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("RATE_LIMIT");
  });

  /** The expensive half of the attack: rejecting after the call is too late. */
  it("refuses before spending a model call", async () => {
    h.hits.set(`ws:ws-1`, REQUEST_HOURLY_LIMIT);
    await ingestRequest(input, freshContext());
    expect(h.parseCalled).not.toHaveBeenCalled();
    expect(h.insertArg).not.toHaveBeenCalled();
  });

  /**
   * The regression this migration exists for. The previous implementation read
   * a count and then inserted, so submissions issued together all observed the
   * same pre-insert count and all passed a limit of 20. Driving the claims
   * concurrently is the only shape that distinguishes an atomic counter from a
   * read-then-write one.
   */
  it("holds the cap when submissions arrive concurrently", async () => {
    const burst = Array.from({ length: REQUEST_HOURLY_LIMIT + 15 }, () =>
      ingestRequest(input, { address: "198.51.100.9" }),
    );
    const results = await Promise.all(burst);

    const accepted = results.filter((r) => r.ok).length;
    // The address cap is the tighter of the two and bites first, which is
    // itself the point: no single caller gets the whole workspace quota.
    expect(accepted).toBe(REQUEST_IP_HOURLY_LIMIT);
    expect(h.parseCalled).toHaveBeenCalledTimes(REQUEST_IP_HOURLY_LIMIT);
  });

  it("surfaces a throttle failure rather than failing open", async () => {
    h.rpcError.value = { message: "counter down" };
    const result = await ingestRequest(input, freshContext());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
    expect(h.parseCalled).not.toHaveBeenCalled();
  });

  it("refuses when the throttle answers neither yes nor no", async () => {
    h.rpcReturnsNull.value = true;
    const result = await ingestRequest(input, freshContext());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("RATE_LIMIT");
    expect(h.parseCalled).not.toHaveBeenCalled();
  });
});

/**
 * An unknown slug used to be answered before anything was counted, which made
 * the 404 a free existence oracle over every workspace in the deployment.
 */
describe("ingestRequest address throttling", () => {
  it("charges the address before the slug is looked up", async () => {
    h.wsResult.value = { data: null, error: null };
    await ingestRequest(input, { address: "203.0.113.200" });

    // One claim, and it is the address bucket — the workspace was never
    // reached, so a probe costs the prober a slot either way.
    expect(h.rpcCalls).toHaveLength(1);
    expect(h.rpcCalls[0]?.bucket).toMatch(/^ip:/);
    expect(h.rpcCalls[0]?.limit).toBe(REQUEST_IP_HOURLY_LIMIT);
  });

  it("throttles slug probing, so enumeration costs quota", async () => {
    const address = "203.0.113.201";
    h.wsResult.value = { data: null, error: null };

    const codes: string[] = [];
    for (let i = 0; i < REQUEST_IP_HOURLY_LIMIT + 3; i += 1) {
      const result = await ingestRequest({ ...input, slug: `guess-${i}` }, { address });
      if (!result.ok) codes.push(result.error.code);
    }

    expect(codes.filter((c) => c === "NOT_FOUND")).toHaveLength(REQUEST_IP_HOURLY_LIMIT);
    expect(codes.filter((c) => c === "RATE_LIMIT")).toHaveLength(3);
  });

  it("claims in order: address, then workspace", async () => {
    await ingestRequest(input, { address: "203.0.113.202" });
    expect(h.rpcCalls.map((c) => c.bucket.split(":")[0])).toEqual(["ip", "ws"]);
  });

  it("does not let one address spend another's quota", async () => {
    h.hits.set("ws:ws-1", 0);
    const a = await ingestRequest(input, { address: "203.0.113.210" });
    const b = await ingestRequest(input, { address: "203.0.113.211" });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(h.hits.get("ws:ws-1")).toBe(2);
  });

  it("puts requests with no usable address in one shared bucket", async () => {
    const first = await ingestRequest(input, { address: null });
    expect(first.ok).toBe(true);
    expect(h.rpcCalls[0]?.bucket).toBe("ip:unknown");
  });
});
