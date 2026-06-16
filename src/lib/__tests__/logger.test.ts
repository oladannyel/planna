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
