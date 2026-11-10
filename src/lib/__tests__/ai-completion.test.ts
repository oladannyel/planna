import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as AiCompletion from "../ai-completion";

const ORIGINAL_ENV = process.env;

const h = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@/lib/ai-client", () => ({
  getAiClient: () => ({ chat: { completions: { create: h.create } } }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** A rejection shaped like one of the SDK's: an Error carrying a status. */
function providerError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${String(status)}`), { status });
}

function completion(model: string): unknown {
  return { model, choices: [{ message: { content: "hi" } }] };
}

function setFallbacks(value?: string): void {
  process.env = { ...ORIGINAL_ENV };
  if (value === undefined) delete process.env.AI_MODEL_FALLBACKS;
  else process.env.AI_MODEL_FALLBACKS = value;
}

/** Re-imported per test, because the chain is read from the environment. */
async function load(): Promise<typeof AiCompletion> {
  return import("../ai-completion");
}

const PARAMS = { model: "primary/model", messages: [{ role: "user" as const, content: "x" }] };

beforeEach(() => {
  vi.resetModules();
  h.create.mockReset();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("modelChain", () => {
  it("is just the primary model when no fallbacks are configured", async () => {
    setFallbacks();
    const { modelChain } = await load();
    expect(modelChain("a/b")).toEqual(["a/b"]);
  });

  it("appends the fallbacks in the order they were written", async () => {
    setFallbacks("second/model, third/model");
    const { modelChain } = await load();
    expect(modelChain("first/model")).toEqual(["first/model", "second/model", "third/model"]);
  });

  it("tolerates stray whitespace and empty entries", async () => {
    setFallbacks("  ,, second/model ,  ");
    const { modelChain } = await load();
    expect(modelChain("first/model")).toEqual(["first/model", "second/model"]);
  });

  it("deduplicates, so one list can safely serve both configured models", async () => {
    setFallbacks("first/model,second/model");
    const { modelChain } = await load();
    expect(modelChain("first/model")).toEqual(["first/model", "second/model"]);
  });
});

describe("createCompletion", () => {
  it("uses the primary model and never touches the chain when it works", async () => {
    setFallbacks("backup/model");
    h.create.mockResolvedValueOnce(completion("primary/model"));

    const { createCompletion } = await load();
    await createCompletion(PARAMS);

    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.create.mock.calls[0]?.[0]).toMatchObject({ model: "primary/model" });
  });

  it("falls back to the next model when the primary is retired (404)", async () => {
    setFallbacks("backup/model");
    h.create.mockRejectedValueOnce(providerError(404));
    h.create.mockResolvedValueOnce(completion("backup/model"));

    const { createCompletion } = await load();
    const result = await createCompletion(PARAMS);

    expect(h.create).toHaveBeenCalledTimes(2);
    expect(h.create.mock.calls[1]?.[0]).toMatchObject({ model: "backup/model" });
    expect(result).toMatchObject({ model: "backup/model" });
  });

  it("falls back when the primary is rate limited, because caps are per-model", async () => {
    setFallbacks("backup/model");
    h.create.mockRejectedValueOnce(providerError(429));
    h.create.mockResolvedValueOnce(completion("backup/model"));

    const { createCompletion } = await load();
    await expect(createCompletion(PARAMS)).resolves.toMatchObject({ model: "backup/model" });
  });

  it("walks the whole chain, not just one step", async () => {
    setFallbacks("second/model,third/model");
    h.create.mockRejectedValueOnce(providerError(404));
    h.create.mockRejectedValueOnce(providerError(503));
    h.create.mockResolvedValueOnce(completion("third/model"));

    const { createCompletion } = await load();
    await createCompletion(PARAMS);

    expect(h.create.mock.calls.map((call) => (call[0] as { model: string }).model)).toEqual([
      "primary/model",
      "second/model",
      "third/model",
    ]);
  });

  it("passes every other parameter through unchanged on a fallback attempt", async () => {
    setFallbacks("backup/model");
    h.create.mockRejectedValueOnce(providerError(404));
    h.create.mockResolvedValueOnce(completion("backup/model"));

    const { createCompletion } = await load();
    await createCompletion({ ...PARAMS, max_tokens: 1234, temperature: 0.1 });

    expect(h.create.mock.calls[1]?.[0]).toMatchObject({
      model: "backup/model",
      max_tokens: 1234,
      temperature: 0.1,
      messages: PARAMS.messages,
    });
  });

  it("does not retry a rejected key — every model shares it", async () => {
    setFallbacks("backup/model");
    h.create.mockRejectedValueOnce(providerError(401));

    const { createCompletion } = await load();
    await expect(createCompletion(PARAMS)).rejects.toMatchObject({ status: 401 });
    expect(h.create).toHaveBeenCalledTimes(1);
  });

  it("does not retry a malformed request", async () => {
    setFallbacks("backup/model");
    h.create.mockRejectedValueOnce(providerError(400));

    const { createCompletion } = await load();
    await expect(createCompletion(PARAMS)).rejects.toMatchObject({ status: 400 });
    expect(h.create).toHaveBeenCalledTimes(1);
  });

  it("does not retry a network failure — the chain shares one base URL", async () => {
    setFallbacks("backup/model");
    h.create.mockRejectedValueOnce(new Error("fetch failed"));

    const { createCompletion } = await load();
    await expect(createCompletion(PARAMS)).rejects.toThrow("fetch failed");
    expect(h.create).toHaveBeenCalledTimes(1);
  });

  it("throws the last provider error with its status intact once the chain is spent", async () => {
    setFallbacks("backup/model");
    h.create.mockRejectedValueOnce(providerError(404));
    h.create.mockRejectedValueOnce(providerError(429));

    const { createCompletion } = await load();
    // The status must survive: classifyProviderError reads it to tell the user
    // whether to wait or to change the configuration.
    await expect(createCompletion(PARAMS)).rejects.toMatchObject({ status: 429 });
    expect(h.create).toHaveBeenCalledTimes(2);
  });

  it("behaves exactly as before when no fallbacks are configured", async () => {
    setFallbacks();
    h.create.mockRejectedValueOnce(providerError(404));

    const { createCompletion } = await load();
    await expect(createCompletion(PARAMS)).rejects.toMatchObject({ status: 404 });
    expect(h.create).toHaveBeenCalledTimes(1);
  });
});

/*
 * Failover on a 200 that is useless.
 *
 * The chain originally only reacted to errors the provider admitted to. A
 * model that answers 200 OK with an empty string or with prose instead of the
 * JSON we asked for is just as broken, and the remedy is the same one — so
 * these cover the half that used to reach the user as "couldn't parse that".
 */
describe("createCompletion — unusable output", () => {
  function answering(model: string, content: string | null): unknown {
    return { model, choices: [{ message: { content }, finish_reason: "stop" }] };
  }

  const acceptsJson = { accept: (content: string) => content.trim().startsWith("{") };

  it("moves to the next model when the answer is rejected by the caller", async () => {
    setFallbacks("second/model");
    h.create
      .mockResolvedValueOnce(answering("primary/model", "I'm sorry, I can't do that."))
      .mockResolvedValueOnce(answering("second/model", '{"tasks":[]}'));

    const { createCompletion } = await load();
    const result = await createCompletion(PARAMS, acceptsJson);

    expect(h.create).toHaveBeenCalledTimes(2);
    expect(result.choices[0]?.message?.content).toBe('{"tasks":[]}');
  });

  it("treats a 200 with null content as unusable", async () => {
    setFallbacks("second/model");
    h.create
      .mockResolvedValueOnce(answering("primary/model", null))
      .mockResolvedValueOnce(answering("second/model", '{"tasks":[]}'));

    const { createCompletion } = await load();
    const result = await createCompletion(PARAMS, acceptsJson);

    expect(h.create).toHaveBeenCalledTimes(2);
    expect(result.choices[0]?.message?.content).toBe('{"tasks":[]}');
  });

  it("returns the last model's answer even when it is unusable", async () => {
    // So the caller still raises its own specific error — "non-JSON output",
    // "empty response" — instead of a generic one invented in here.
    setFallbacks("second/model");
    h.create
      .mockResolvedValueOnce(answering("primary/model", "nope"))
      .mockResolvedValueOnce(answering("second/model", "also nope"));

    const { createCompletion } = await load();
    const result = await createCompletion(PARAMS, acceptsJson);

    expect(h.create).toHaveBeenCalledTimes(2);
    expect(result.choices[0]?.message?.content).toBe("also nope");
  });

  it("does not re-request when the first answer is accepted", async () => {
    setFallbacks("second/model");
    h.create.mockResolvedValueOnce(answering("primary/model", '{"tasks":[]}'));

    const { createCompletion } = await load();
    await createCompletion(PARAMS, acceptsJson);

    expect(h.create).toHaveBeenCalledTimes(1);
  });

  it("accepts anything when no predicate is given", async () => {
    setFallbacks("second/model");
    h.create.mockResolvedValueOnce(answering("primary/model", ""));

    const { createCompletion } = await load();
    await createCompletion(PARAMS);

    expect(h.create).toHaveBeenCalledTimes(1);
  });
});
