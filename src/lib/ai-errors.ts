import type { AppError } from "@/lib/result";

function statusOf(cause: unknown): number | undefined {
  const status =
    typeof cause === "object" && cause !== null && "status" in cause
      ? (cause as { status?: unknown }).status
      : undefined;
  return typeof status === "number" ? status : undefined;
}

/**
 * Classify a thrown OpenRouter/OpenAI-SDK error by HTTP status.
 *
 * Without this, every upstream failure — a revoked key, a retired model, a
 * quota cap — surfaced as a generic AI_ERROR, which the UI renders as
 * "Couldn't parse that". That blames the user's input for a configuration
 * fault and sends them to the wrong fix. The distinction matters because the
 * remedies are completely different: rotate the key, change the model, or
 * simply wait.
 *
 * Returns null when the cause carries no usable status, so callers keep their
 * existing AI_ERROR fallback.
 */
export function classifyProviderError(cause: unknown): AppError | null {
  const status = statusOf(cause);

  if (status === undefined) return null;

  if (status === 401 || status === 403) {
    return {
      code: "AI_UNAVAILABLE",
      message: "The AI service rejected our credentials.",
      cause,
    };
  }
  if (status === 404) {
    return {
      code: "AI_UNAVAILABLE",
      message: "The configured AI model is no longer available.",
      cause,
    };
  }
  if (status === 429) {
    return { code: "RATE_LIMIT", message: "The AI service is rate limited." };
  }
  if (status >= 500) {
    return {
      code: "AI_UNAVAILABLE",
      message: "The AI service is temporarily unavailable.",
      cause,
    };
  }
  return null;
}

/**
 * Would a *different model* plausibly have succeeded?
 *
 * This is the whole decision behind the fallback chain, and it is narrower
 * than "did the call fail":
 *
 *   • 404 — this model is retired. Another one is the entire fix.
 *   • 429 — this model's free pool is capped. Caps are per-model, so the next
 *     model in the chain is often wide open.
 *   • 408 / 5xx — this model's backend is unwell. Worth one more try elsewhere.
 *
 * Everything else is deliberately *not* retried, because retrying would only
 * burn latency on a guaranteed second failure:
 *
 *   • 401 / 403 — the key is rejected, and every model in the chain uses the
 *     same key. Swapping slugs cannot help.
 *   • 400 / 422 — our request is malformed. It will be malformed next time too.
 *   • No status at all — the network or base URL is down. The chain shares one
 *     `AI_BASE_URL`, so there is nowhere else to go.
 */
export function isWorthAnotherModel(cause: unknown): boolean {
  const status = statusOf(cause);
  if (status === undefined) return false;
  return status === 404 || status === 408 || status === 429 || status >= 500;
}

/** The status a failure carried, for logging. */
export function providerStatusOf(cause: unknown): number | undefined {
  return statusOf(cause);
}
