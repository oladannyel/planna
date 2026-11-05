import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = process.env;

const VALID_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  OPENROUTER_API_KEY: "key",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

describe("env", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV, ...VALID_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("parses a valid environment and applies defaults", async () => {
    const { env } = await import("../env");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
    expect(env.OPENROUTER_BASE_URL).toBe("https://openrouter.ai/api/v1");
    expect(env.OPENROUTER_FREE_MODEL).toBe("openrouter/free");
    expect(env.OPENROUTER_REPORT_MODEL).toBe("openrouter/free");
  });

  it("respects an explicit OPENROUTER_BASE_URL override", async () => {
    process.env.OPENROUTER_BASE_URL = "https://proxy.example.com/v1";
    const { env } = await import("../env");
    expect(env.OPENROUTER_BASE_URL).toBe("https://proxy.example.com/v1");
  });

  it("throws when a required variable is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(import("../env")).rejects.toThrow();
  });

  it("throws when a URL variable is malformed", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
    await expect(import("../env")).rejects.toThrow();
  });
});
