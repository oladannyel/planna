import type { AppError } from "@/lib/result";
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
  const status =
    typeof cause === "object" && cause !== null && "status" in cause
      ? (cause as { status?: unknown }).status
      : undefined;

  if (typeof status !== "number") return null;

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
