import type OpenAI from "openai";

import { getAiClient } from "@/lib/ai-client";
import { isWorthAnotherModel, providerStatusOf } from "@/lib/ai-errors";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/*
 * Rethrow the provider's own error object, untouched.
 *
 * Wrapping it in a fresh Error would be type-safe and useless: the SDK hangs
 * the HTTP status off the thrown object, and `classifyProviderError` reads it
 * to tell a dead model from a dead key. Preserving the original is the point.
 */
function rethrow(cause: unknown): never {
  throw cause;
}

/**
 * The models to try, in order: the one asked for, then `AI_MODEL_FALLBACKS`.
 *
 * Deduplicated, so listing the primary again in the fallbacks — easy to do
 * when one list serves both `AI_MODEL` and `AI_REPORT_MODEL` — costs nothing.
 */
export function modelChain(primary: string): string[] {
  const fallbacks = env.AI_MODEL_FALLBACKS.split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return [...new Set([primary, ...fallbacks])];
}

/** The assistant text a completion carried, or "" when it carried none. */
function contentOf(completion: OpenAI.ChatCompletion): string {
  return completion.choices[0]?.message?.content ?? "";
}

export interface CompletionOptions {
  /**
   * Is this model's answer usable to the caller?
   *
   * HTTP status is not the only way a model fails. A reasoning model handed a
   * long prompt can spend its whole token budget on the scratchpad and return
   * `content: null` with a 200; a small model can ignore "JSON only" and
   * answer in prose. Both are 200 OK, both are useless, and both are fixed by
   * exactly the same thing as a 404: a different model.
   *
   * Without this the chain only covered the failures the provider admitted
   * to, which are the easy half. Return false and the next model is tried;
   * the last model's answer is returned regardless, so the caller still gets
   * to raise its own specific error rather than a generic one from here.
   */
  accept?: (content: string) => boolean;
}

/**
 * One chat completion, with automatic failover down the model chain.
 *
 * Free-tier models are retired without notice and their daily caps are
 * per-model, so a single configured slug is a single point of failure that
 * surfaces to the user as a note that will not parse. This walks the chain
 * instead, and only the failures no other model could fix propagate — see
 * `isWorthAnotherModel`.
 *
 * Failover happens per request and needs no redeploy, which is why the daily
 * health check only *reports* a dead model rather than rewriting config: by
 * the time anyone reads the alert, this has already routed around it.
 *
 * Throws the provider's last error, so existing callers keep their
 * `classifyProviderError` handling unchanged.
 */
export async function createCompletion(
  params: OpenAI.ChatCompletionCreateParamsNonStreaming,
  options: CompletionOptions = {},
): Promise<OpenAI.ChatCompletion> {
  const chain = modelChain(params.model);

  for (const [index, model] of chain.entries()) {
    const isLast = index === chain.length - 1;
    try {
      const completion = await getAiClient().chat.completions.create({ ...params, model });

      if (!isLast && options.accept && !options.accept(contentOf(completion))) {
        logger.warn("AI model answered with unusable output — trying the next in the chain", {
          model,
          next: chain[index + 1],
          finishReason: completion.choices[0]?.finish_reason,
          contentLength: contentOf(completion).length,
        });
        continue;
      }

      if (index > 0) {
        logger.warn("AI completion served by a fallback model", {
          model,
          configured: chain[0],
          skipped: index,
        });
      }
      return completion;
    } catch (cause) {
      if (isLast || !isWorthAnotherModel(cause)) rethrow(cause);
      logger.warn("AI model failed — falling back to the next in the chain", {
        model,
        next: chain[index + 1],
        status: providerStatusOf(cause),
      });
    }
  }

  // Unreachable: the chain always holds at least the primary model, and every
  // path through the loop body either returns or throws.
  throw new Error("Model chain exhausted without a result");
}
