import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The parser's half of the failover contract.
 *
 * `ai-completion.test.ts` proves the chain honours an `accept` predicate.
 * This proves the parser supplies one — that "the model replied, but not with
 * our JSON" reaches the next model instead of reaching the user as
 * "Couldn't parse that", which blames their notes for the model's answer.
 *
 * It lives apart from `parser.test.ts` because the chain is read out of the
 * environment at import time, so it needs its own module registry.
 */

const ORIGINAL_ENV = process.env;

const h = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@/lib/ai-client", () => ({
  getAiClient: () => ({ chat: { completions: { create: h.create } } }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const TASK = {
  title: "Prep for meeting with Nike",
  priority: "high",
  tags: ["nike"],
  dueDate: null,
  estimatedMinutes: null,
  status: "todo",
  confidence: 0.9,
};

function answering(content: string | null): unknown {
  return { choices: [{ message: { content }, finish_reason: "stop" }] };
}

beforeEach(() => {
  vi.resetModules();
  h.create.mockReset();
  process.env = { ...ORIGINAL_ENV, AI_MODEL_FALLBACKS: "second/model" };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("parseMultipleTasksFromText — failover on unusable answers", () => {
  it("retries on the next model when the first answers in prose", async () => {
    h.create
      .mockResolvedValueOnce(answering("Sure! Here are your tasks: prep for the Nike meeting."))
      .mockResolvedValueOnce(answering(JSON.stringify({ tasks: [TASK] })));

    const { parseMultipleTasksFromText } = await import("../parser");
    const result = await parseMultipleTasksFromText("Prep for meeting with Nike");

    expect(h.create).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.title).toBe("Prep for meeting with Nike");
  });

  it("retries when the first model spends its budget and returns nothing", async () => {
    h.create
      .mockResolvedValueOnce(answering(null))
      .mockResolvedValueOnce(answering(JSON.stringify({ tasks: [TASK] })));

    const { parseMultipleTasksFromText } = await import("../parser");
    const result = await parseMultipleTasksFromText("Prep for meeting with Nike");

    expect(h.create).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("retries when the JSON is well-formed but the wrong shape", async () => {
    h.create
      .mockResolvedValueOnce(answering(JSON.stringify({ items: [TASK] })))
      .mockResolvedValueOnce(answering(JSON.stringify({ tasks: [TASK] })));

    const { parseMultipleTasksFromText } = await import("../parser");
    const result = await parseMultipleTasksFromText("Prep for meeting with Nike");

    expect(h.create).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("still names the specific failure when every model answers badly", async () => {
    h.create
      .mockResolvedValueOnce(answering("nope"))
      .mockResolvedValueOnce(answering("still nope"));

    const { parseMultipleTasksFromText } = await import("../parser");
    const result = await parseMultipleTasksFromText("Prep for meeting with Nike");

    expect(h.create).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toBe("AI returned non-JSON output");
  });

  it("does not spend a second call when the first answer is good", async () => {
    h.create.mockResolvedValueOnce(answering(JSON.stringify({ tasks: [TASK] })));

    const { parseMultipleTasksFromText } = await import("../parser");
    const result = await parseMultipleTasksFromText("Prep for meeting with Nike");

    expect(h.create).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });
});
