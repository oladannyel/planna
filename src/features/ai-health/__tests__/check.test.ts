import { describe, expect, it, vi } from "vitest";

import { checkKey, checkModel, runHealthCheck } from "../check";

type FetchArgs = [input: RequestInfo | URL, init?: RequestInit];

/** A fetch stub that routes on the requested URL, typed like the real thing. */
function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  return vi.fn((...[input, init]: FetchArgs) => Promise.resolve(handler(urlOf(input), init)));
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function completion(content: string | null, model = "served/model", finish = "stop"): unknown {
  return { model, choices: [{ finish_reason: finish, message: { content } }] };
}

function sentBody(init: RequestInit | undefined): Record<string, unknown> {
  return JSON.parse(typeof init?.body === "string" ? init.body : "{}") as Record<string, unknown>;
}

describe("checkKey", () => {
  it("reports a live key", async () => {
    await expect(checkKey(stubFetch(() => jsonResponse({ data: {} })))).resolves.toMatchObject({
      alive: true,
      status: 200,
    });
  });

  /** The failure that took production down: a revoked key answers 401. */
  it("reports a revoked key with the provider's message", async () => {
    const result = await checkKey(
      stubFetch(() => jsonResponse({ error: { message: "User not found." } }, 401)),
    );
    expect(result.alive).toBe(false);
    expect(result.detail).toBe("User not found.");
  });

  /**
   * `GET /key` is an OpenRouter extension. Every other OpenAI-compatible
   * provider 404s it, and calling that a dead key would report a perfectly
   * healthy OpenAI or Ollama setup as broken.
   */
  it("defers to the model probes when the provider has no key endpoint", async () => {
    for (const status of [404, 405]) {
      const result = await checkKey(stubFetch(() => jsonResponse({}, status)));
      expect(result).toMatchObject({ alive: true, skipped: true, status });
    }
  });

  it("still trusts an explicit rejection over deferring", async () => {
    const result = await checkKey(stubFetch(() => jsonResponse({ error: {} }, 403)));
    expect(result.alive).toBe(false);
    expect(result.skipped).toBeUndefined();
  });

  it("treats a network failure as a dead key", async () => {
    const result = await checkKey(
      vi.fn((...[]: FetchArgs) => Promise.reject(new Error("socket hang up"))),
    );
    expect(result).toMatchObject({ alive: false, status: 0, detail: "socket hang up" });
  });
});

describe("checkModel", () => {
  it("reports a working model and which model actually served it", async () => {
    const result = await checkModel(
      "openrouter/free",
      stubFetch(() => jsonResponse(completion('{"ok":true}', "nvidia/nemotron:free"))),
    );
    expect(result.verdict).toBe("ok");
    expect(result.servedBy).toBe("nvidia/nemotron:free");
  });

  it("calls the model it was asked to check", async () => {
    const fetchImpl = stubFetch(() => jsonResponse(completion("ok")));
    await checkModel("some/model:free", fetchImpl);
    expect(sentBody(fetchImpl.mock.calls[0]?.[1]).model).toBe("some/model:free");
  });

  it("treats a retired model (404) as dead", async () => {
    const result = await checkModel(
      "gone/model",
      stubFetch(() => jsonResponse({ error: { message: "No endpoints found" } }, 404)),
    );
    expect(result.verdict).toBe("dead");
    expect(result.detail).toBe("No endpoints found");
  });

  /** A busy shared free pool is normal — it must not page anyone. */
  it("treats an upstream 429 as degraded, not dead", async () => {
    const result = await checkModel(
      "busy/model",
      stubFetch(() => jsonResponse({ error: { message: "rate-limited upstream" } }, 429)),
    );
    expect(result.verdict).toBe("degraded");
  });

  it("flags an empty completion as degraded", async () => {
    const result = await checkModel(
      "openrouter/free",
      stubFetch(() => jsonResponse(completion(null, "reasoner/model", "length"))),
    );
    expect(result.verdict).toBe("degraded");
    expect(result.finishReason).toBe("length");
    expect(result.detail).toBe("Returned no content");
  });

  /**
   * Guards the trap that made a healthy model look broken: a 10-token probe
   * let a reasoning model spend its whole budget before emitting any content.
   */
  it("gives reasoning models enough budget to emit content", async () => {
    const fetchImpl = stubFetch(() => jsonResponse(completion("ok")));
    await checkModel("any/model", fetchImpl);
    expect(sentBody(fetchImpl.mock.calls[0]?.[1]).max_tokens).toBeGreaterThanOrEqual(256);
  });

  it("survives a non-JSON response body", async () => {
    const result = await checkModel(
      "any/model",
      stubFetch(
        () =>
          ({
            ok: false,
            status: 502,
            json: () => Promise.reject(new Error("not json")),
          }) as unknown as Response,
      ),
    );
    expect(result).toMatchObject({ verdict: "dead", detail: "HTTP 502" });
  });
});

describe("runHealthCheck", () => {
  it("is healthy when the key and models all answer", async () => {
    const report = await runHealthCheck(
      stubFetch((url) =>
        url.endsWith("/key") ? jsonResponse({ data: {} }) : jsonResponse(completion("ok")),
      ),
    );
    expect(report.healthy).toBe(true);
    expect(report.models.length).toBeGreaterThan(0);
  });

  it("does not waste probes on models when the key is already dead", async () => {
    const fetchImpl = stubFetch(() => jsonResponse({ error: {} }, 401));
    const report = await runHealthCheck(fetchImpl);
    expect(report.healthy).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(report.models.every((m) => m.verdict === "dead")).toBe(true);
  });

  it("stays healthy when a model is merely degraded", async () => {
    const report = await runHealthCheck(
      stubFetch((url) =>
        url.endsWith("/key")
          ? jsonResponse({ data: {} })
          : jsonResponse({ error: { message: "busy" } }, 429),
      ),
    );
    expect(report.healthy).toBe(true);
    expect(report.models[0]?.verdict).toBe("degraded");
  });

  it("still probes models on a provider with no key endpoint", async () => {
    const report = await runHealthCheck(
      stubFetch((url) =>
        url.endsWith("/key") ? jsonResponse({}, 404) : jsonResponse(completion("ok")),
      ),
    );
    expect(report.key.skipped).toBe(true);
    expect(report.healthy).toBe(true);
    expect(report.models.every((m) => m.verdict === "ok")).toBe(true);
  });

  it("is unhealthy when a model is dead", async () => {
    const report = await runHealthCheck(
      stubFetch((url) =>
        url.endsWith("/key") ? jsonResponse({ data: {} }) : jsonResponse({ error: {} }, 404),
      ),
    );
    expect(report.healthy).toBe(false);
  });
});
