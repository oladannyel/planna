import OpenAI from "openai";

import { env } from "@/lib/env";

let client: OpenAI | null = null;

/**
 * Lazily construct the OpenRouter client (OpenAI-compatible: same SDK, different
 * baseURL + headers). Lazy so importing this module has no side effects — the
 * OpenAI constructor otherwise throws in browser-like environments (e.g. jsdom).
 */
export function getOpenRouter(): OpenAI {
  client ??= new OpenAI({
    baseURL: env.OPENROUTER_BASE_URL,
    apiKey: env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
      "X-Title": "plAnna",
    },
  });
  return client;
}
