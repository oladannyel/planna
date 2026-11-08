import { describe, expect, it } from "vitest";

import { classifyProviderError } from "../ai-errors";

/**
 * These cover the failure that shipped to production: a revoked OpenRouter key
 * returned 401, which the UI rendered as "Couldn't parse that" — blaming the
 * user's input for a credentials fault.
 */
describe("classifyProviderError", () => {
  it("treats 401 as a credentials failure, not a parse failure", () => {
    const result = classifyProviderError({ status: 401 });
    expect(result?.code).toBe("AI_UNAVAILABLE");
    expect(result?.message).toMatch(/credentials/i);
  });

  it("treats 403 as a credentials failure", () => {
    expect(classifyProviderError({ status: 403 })?.code).toBe("AI_UNAVAILABLE");
  });

  it("reports a retired model distinctly from bad credentials", () => {
    const result = classifyProviderError({ status: 404 });
    expect(result?.code).toBe("AI_UNAVAILABLE");
    expect(result?.message).toMatch(/model/i);
  });

  it("maps 429 to RATE_LIMIT so the user knows to wait", () => {
    expect(classifyProviderError({ status: 429 })?.code).toBe("RATE_LIMIT");
  });

  it("maps upstream 5xx to AI_UNAVAILABLE", () => {
    expect(classifyProviderError({ status: 500 })?.code).toBe("AI_UNAVAILABLE");
    expect(classifyProviderError({ status: 503 })?.code).toBe("AI_UNAVAILABLE");
  });

  it("returns null for a 4xx with no specific meaning, keeping the AI_ERROR fallback", () => {
    expect(classifyProviderError({ status: 400 })).toBeNull();
  });

  it("returns null when the cause carries no status", () => {
    expect(classifyProviderError(new Error("socket hang up"))).toBeNull();
    expect(classifyProviderError(null)).toBeNull();
    expect(classifyProviderError("boom")).toBeNull();
    expect(classifyProviderError({ status: "401" })).toBeNull();
  });

  it("preserves the original cause for logging", () => {
    const cause = { status: 401, detail: "User not found." };
    const result = classifyProviderError(cause);
    expect(result && "cause" in result ? result.cause : undefined).toBe(cause);
  });
});
