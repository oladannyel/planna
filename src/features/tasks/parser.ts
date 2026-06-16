import { z } from "zod";

import { env } from "@/lib/env";
import { getOpenRouter } from "@/lib/openrouter";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";

import type { ParsedTaskResult } from "./types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const parsedSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  tags: z.array(z.string()),
  dueDate: z.string().regex(ISO_DATE_RE).nullable(),
  estimatedMinutes: z.number().int().positive().nullable(),
  confidence: z.number(),
});

function today(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

const SYSTEM_PROMPT = `You are a task parser. Extract structured task data from natural language input.
Today's date: ${today()}.
Respond ONLY with valid JSON matching this shape exactly:
{
  "title": "clean concise task title",
  "priority": "low" | "medium" | "high" | "urgent",
  "tags": ["tag1", "tag2"],
  "dueDate": "YYYY-MM-DD" | null,
  "estimatedMinutes": number | null,
  "confidence": 0.0-1.0
}
No preamble, no markdown, no explanation. JSON only.`;

/**
 * Pull a JSON object out of a model response: strips ```json fences and any
 * prose surrounding the object, then returns the `{...}` slice.
 */
function extractJson(content: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(content);
  const body = fenced?.[1] ?? content;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    return body.trim();
  }
  return body.slice(start, end + 1);
}

/** Parse free-text into a structured task via the OpenRouter free model. */
export async function parseTaskFromText(rawText: string): Promise<Result<ParsedTaskResult>> {
  try {
    const response = await getOpenRouter().chat.completions.create({
      model: env.OPENROUTER_FREE_MODEL,
      max_tokens: 300,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: rawText },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return err({ code: "AI_ERROR", message: "Empty response from AI parser" });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(content));
    } catch {
      return err({ code: "AI_ERROR", message: "AI returned non-JSON output" });
    }

    const validated = parsedSchema.safeParse(parsed);
    if (!validated.success) {
      return err({
        code: "VALIDATION_ERROR",
        message: "AI returned invalid structure",
        fields: validated.error.flatten().fieldErrors,
      });
    }

    const confidence = Math.min(1, Math.max(0, validated.data.confidence));
    return ok({ ...validated.data, confidence });
  } catch (cause) {
    return err({ code: "AI_ERROR", message: "Task parsing failed", cause });
  }
}
