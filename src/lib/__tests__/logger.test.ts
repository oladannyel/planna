import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "../logger";

interface ParsedLog {
  level: string;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

function lastCallArg(spy: ReturnType<typeof vi.spyOn>): ParsedLog {
  const calls = spy.mock.calls;
  const arg = calls[calls.length - 1]?.[0];
  return JSON.parse(String(arg)) as ParsedLog;
}

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("info logs structured JSON to console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logger.info("hello", { user: "abc" });
    const record = lastCallArg(spy);
    expect(record.level).toBe("info");
    expect(record.message).toBe("hello");
    expect(record.context).toEqual({ user: "abc" });
    expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("debug routes to console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logger.debug("dbg");
    expect(lastCallArg(spy).level).toBe("debug");
  });

  it("warn routes to console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    logger.warn("careful");
    expect(lastCallArg(spy).level).toBe("warn");
  });

  it("error routes to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logger.error("boom", { cause: "x" });
    const record = lastCallArg(spy);
    expect(record.level).toBe("error");
    expect(record.context).toEqual({ cause: "x" });
  });

  it("omits the context field when none is given", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logger.info("no-context");
    expect(lastCallArg(spy).context).toBeUndefined();
  });
});

/**
 * SECURITY.md promises the service-role key never reaches a log line. These
 * are the tests that make that a property of the code rather than a habit.
 */
describe("logger redaction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function logged(fn: () => void): ParsedLog {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fn();
    return lastCallArg(spy);
  }

  it("redacts a value whose key names a secret", () => {
    const record = logged(() =>
      logger.error("failed", { apiKey: "sk-live-abcdef0123456789", workspace: "ws-1" }),
    );
    expect(JSON.stringify(record)).not.toContain("sk-live-abcdef0123456789");
    expect(record.context?.apiKey).toBe("[redacted]");
    // Everything else survives, or the log stops being useful.
    expect(record.context?.workspace).toBe("ws-1");
  });

  it.each([
    "SUPABASE_SERVICE_ROLE_KEY",
    "authorization",
    "Cookie",
    "access_token",
    "db_password",
    "credentials",
  ])("redacts the key %s whatever its case or position", (key) => {
    const record = logged(() => logger.error("x", { [key]: "sensitive-value" }));
    expect(JSON.stringify(record)).not.toContain("sensitive-value");
  });

  it("redacts a JWT hiding under an innocent key", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2lnbmF0dXJldmFsdWU";
    const record = logged(() => logger.error("boom", { detail: `rejected ${jwt}` }));
    expect(JSON.stringify(record)).not.toContain(jwt);
  });

  it("redacts a bearer token in a message, not just in context", () => {
    const record = logged(() => logger.error("upstream said Bearer sk-abcdef0123456789 is bad"));
    expect(record.message).not.toContain("sk-abcdef0123456789");
    expect(record.message).toContain("[redacted]");
  });

  it("keeps the host of a connection string but drops the password", () => {
    const record = logged(() =>
      logger.error("db down", { url: "postgresql://postgres:hunter2@db.example.co:5432/x" }),
    );
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain("hunter2");
    expect(serialized).toContain("db.example.co");
  });

  it("reaches secrets nested inside objects and arrays", () => {
    const record = logged(() => logger.error("x", { outer: { inner: [{ token: "abc123xyz" }] } }));
    expect(JSON.stringify(record)).not.toContain("abc123xyz");
  });

  /** An upstream error that references its own client would otherwise hang. */
  it("survives a circular reference", () => {
    const circular: Record<string, unknown> = { name: "client" };
    circular.self = circular;
    const record = logged(() => logger.error("x", { circular }));
    expect(JSON.stringify(record)).toContain("[circular]");
  });

  it("serialises an Error instead of logging an empty object", () => {
    const record = logged(() => logger.error("x", { error: new Error("went wrong") }));
    // `error` is not a sensitive key, so the Error itself must be readable.
    const serialized = JSON.stringify(record.context);
    expect(serialized).toContain("went wrong");
    expect(serialized).toContain("Error");
  });

  it("redacts a secret inside an Error message", () => {
    const record = logged(() =>
      logger.error("x", { cause: new Error("401 for sk-abcdef0123456789") }),
    );
    expect(JSON.stringify(record)).not.toContain("sk-abcdef0123456789");
  });

  it("leaves ordinary context untouched", () => {
    const record = logged(() =>
      logger.error("x", { count: 3, ok: false, name: "weekly report", tags: ["a", "b"] }),
    );
    expect(record.context).toEqual({
      count: 3,
      ok: false,
      name: "weekly report",
      tags: ["a", "b"],
    });
  });
});
