import { afterEach, describe, expect, it, vi } from "vitest";

import { GOLDEN_CASES } from "./golden/parser-cases";

const h = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@/lib/openrouter", () => ({
  getOpenRouter: () => ({ chat: { completions: { create: h.create } } }),
}));

const { parseTaskFromText } = await import("../parser");

function mockContent(content: string | null): void {
  h.create.mockResolvedValue({ choices: [{ message: { content } }] });
}

afterEach(() => {
  h.create.mockReset();
});

describe("parseTaskFromText — golden dataset", () => {
  it.each(GOLDEN_CASES)("$name", async ({ input, modelContent, expected }) => {
    mockContent(modelContent);
    const result = await parseTaskFromText(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(expected);
    }
  });

  it("covers at least 10 golden cases", () => {
    expect(GOLDEN_CASES.length).toBeGreaterThanOrEqual(10);
  });
});

describe("parseTaskFromText — error handling", () => {
  it("returns AI_ERROR on empty content", async () => {
    mockContent("");
    const result = await parseTaskFromText("x");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AI_ERROR");
  });

  it("returns AI_ERROR when content is null", async () => {
    mockContent(null);
    const result = await parseTaskFromText("x");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AI_ERROR");
  });

  it("returns AI_ERROR on non-JSON output", async () => {
    mockContent("I could not parse that, sorry.");
    const result = await parseTaskFromText("x");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AI_ERROR");
  });

  it("returns VALIDATION_ERROR on a structurally invalid object", async () => {
    mockContent('{"title":"x","priority":"sometime","tags":[],"dueDate":null,"confidence":0.5}');
    const result = await parseTaskFromText("x");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns VALIDATION_ERROR on a malformed due date", async () => {
    mockContent(
      '{"title":"x","priority":"low","tags":[],"dueDate":"tomorrow","estimatedMinutes":null,"confidence":0.5}',
    );
    const result = await parseTaskFromText("x");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns AI_ERROR when the client throws", async () => {
    h.create.mockRejectedValue(new Error("network down"));
    const result = await parseTaskFromText("x");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AI_ERROR");
  });
});
