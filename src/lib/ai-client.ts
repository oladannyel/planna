import OpenAI from "openai";

import { env } from "@/lib/env";

let client: OpenAI | null = null;

/**
 * Lazily construct the chat-completions client.
 *
 * The OpenAI SDK is used as a protocol client, not as a commitment to OpenAI:
 * `AI_BASE_URL` points it at whichever OpenAI-compatible endpoint you
 * configure — OpenRouter by default, but equally OpenAI, Groq, Together,
 * Fireworks, or a local Ollama / vLLM server.
 *
 * Lazy so importing this module has no side effects — the OpenAI constructor
 * otherwise throws in browser-like environments (e.g. jsdom).
 */
export function getAiClient(): OpenAI {
  client ??= new OpenAI({
    baseURL: env.AI_BASE_URL,
    apiKey: env.AI_API_KEY,
    // Attribution headers that OpenRouter uses to credit the app. Other
    // providers ignore unknown headers, so these are safe to always send.
    defaultHeaders: {
      "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
      "X-Title": "plAnna",
    },
  });
  return client;
}
