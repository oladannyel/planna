import { modelChain } from "@/lib/ai-completion";
import { env } from "@/lib/env";

export type ModelVerdict = "ok" | "degraded" | "dead";

export interface ModelHealth {
  model: string;
  verdict: ModelVerdict;
  /** Which model actually served the request — routers pick one per call. */
  servedBy?: string;
  status?: number;
  finishReason?: string;
  detail?: string;
}

export interface KeyHealth {
  /** False only when the provider actively rejected the key. */
  alive: boolean;
  status: number;
  detail?: string;
  /** True when this provider exposes no endpoint to check a key against. */
  skipped?: boolean;
}

export interface HealthReport {
  checkedAt: string;
  healthy: boolean;
  key: KeyHealth;
  models: ModelHealth[];
}

/**
 * Enough headroom that a reasoning model can finish its scratchpad and still
 * emit content.
 *
 * This is the whole trap: a reasoning model given a small budget spends it all
 * on reasoning tokens and returns `content: null` with `finish_reason:
 * "length"`. A probe capped at 10 tokens therefore reports a perfectly healthy
 * model as broken. Keep this comfortably above the reasoning budget of the
 * free models, and judge truncation separately from failure.
 */
const PROBE_MAX_TOKENS = 512;

const PROBE_PROMPT = 'Reply with exactly: {"ok":true}';

/**
 * Models worth probing: both configured models and every fallback behind them.
 *
 * The fallbacks have to be in here. They are exactly the models nobody
 * notices breaking — traffic only reaches them once the primary is already
 * down, so an unprobed chain quietly rots until the day it is needed.
 */
export function configuredModels(): string[] {
  return [...new Set([...modelChain(env.AI_MODEL), ...modelChain(env.AI_REPORT_MODEL)])];
}

/**
 * Is the API key itself still valid? A dead key makes every model look dead,
 * so checking it first turns a confusing wall of failures into one answer.
 *
 * `GET /key` is an OpenRouter extension, not part of the OpenAI-compatible
 * surface. Pointed at OpenAI, Groq, Together or a local Ollama it simply 404s,
 * and treating that as a dead key would report every other provider as broken.
 * So a 404 or 405 here means "this provider has no such endpoint" and the
 * verdict is deferred to the model probes, which exercise the key anyway.
 *
 * 401 and 403 are still trusted: those are the provider rejecting the key.
 */
export async function checkKey(fetchImpl: typeof fetch = fetch): Promise<KeyHealth> {
  try {
    const response = await fetchImpl(`${env.AI_BASE_URL}/key`, {
      headers: { Authorization: `Bearer ${env.AI_API_KEY}` },
    });
    if (response.ok) return { alive: true, status: response.status };

    if (response.status === 404 || response.status === 405) {
      return {
        alive: true,
        status: response.status,
        skipped: true,
        detail: "Provider has no key endpoint — judged by the model probes instead",
      };
    }

    const body: unknown = await response.json().catch(() => null);
    return {
      alive: false,
      status: response.status,
      detail: errorMessageOf(body) ?? `HTTP ${response.status}`,
    };
  } catch (cause) {
    return { alive: false, status: 0, detail: causeMessage(cause) };
  }
}

/** Send one real completion, because only a real call proves a model works. */
export async function checkModel(
  model: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ModelHealth> {
  try {
    const response = await fetchImpl(`${env.AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: PROBE_MAX_TOKENS,
        temperature: 0,
        messages: [{ role: "user", content: PROBE_PROMPT }],
      }),
    });

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      // 429 is a shared upstream pool being busy, not a retired model — it is
      // worth surfacing but does not mean the configuration is broken.
      return {
        model,
        verdict: response.status === 429 ? "degraded" : "dead",
        status: response.status,
        detail: errorMessageOf(body) ?? `HTTP ${response.status}`,
      };
    }

    const choice = firstChoice(body);
    const content = choice?.content ?? "";
    const servedBy = servedModelOf(body);

    if (!content.trim()) {
      return {
        model,
        verdict: "degraded",
        status: response.status,
        ...(servedBy ? { servedBy } : {}),
        ...(choice?.finishReason ? { finishReason: choice.finishReason } : {}),
        detail: "Returned no content",
      };
    }

    return {
      model,
      verdict: "ok",
      status: response.status,
      ...(servedBy ? { servedBy } : {}),
      ...(choice?.finishReason ? { finishReason: choice.finishReason } : {}),
    };
  } catch (cause) {
    return { model, verdict: "dead", status: 0, detail: causeMessage(cause) };
  }
}

/**
 * Full report: the key, then every configured model.
 *
 * `healthy` is false only when something needs a human — a dead key or a dead
 * model. A `degraded` model is reported but does not fail the check, because
 * a shared free pool being briefly rate-limited is normal and paging on it
 * would train everyone to ignore the alert.
 */
export async function runHealthCheck(fetchImpl: typeof fetch = fetch): Promise<HealthReport> {
  const key = await checkKey(fetchImpl);
  const models = key.alive
    ? await Promise.all(configuredModels().map((model) => checkModel(model, fetchImpl)))
    : configuredModels().map((model): ModelHealth => ({
        model,
        verdict: "dead",
        detail: "Not probed — the API key is not valid",
      }));

  return {
    checkedAt: new Date().toISOString(),
    healthy: key.alive && models.every((m) => m.verdict !== "dead"),
    key,
    models,
  };
}

// ─── Response shape helpers ───────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function errorMessageOf(body: unknown): string | undefined {
  const error = asRecord(asRecord(body)?.error);
  const message = error?.message;
  return typeof message === "string" ? message : undefined;
}

function servedModelOf(body: unknown): string | undefined {
  const model = asRecord(body)?.model;
  return typeof model === "string" ? model : undefined;
}

function firstChoice(body: unknown): { content: string; finishReason?: string } | null {
  const choices = asRecord(body)?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const choice = asRecord(choices[0]);
  if (!choice) return null;
  const message = asRecord(choice.message);
  const content = message?.content;
  const finishReason = choice.finish_reason;
  return {
    content: typeof content === "string" ? content : "",
    ...(typeof finishReason === "string" ? { finishReason } : {}),
  };
}

function causeMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
