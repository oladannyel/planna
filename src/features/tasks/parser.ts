import { z } from "zod";

import { createCompletion } from "@/lib/ai-completion";
import { classifyProviderError } from "@/lib/ai-errors";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";

import type { ParsedTaskResult } from "./types";

// ─── Output schema ────────────────────────────────────────────────────────────

const parsedTaskSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  tags: z.array(z.string()).max(5),
  // Models vary on whether they emit explicit null keys or omit them entirely
  // (e.g. nvidia/nemotron drops null fields). Accept both — missing → null.
  dueDate: z.string().nullable().optional().default(null),
  estimatedMinutes: z.number().nullable().optional().default(null),
  status: z.enum(["todo", "in_progress", "done", "cancelled", "skip"]),
  confidence: z.number().min(0).max(1),
});

const parsedBlobSchema = z.object({
  tasks: z.array(parsedTaskSchema).min(1).max(50),
});

type ParsedBlob = z.infer<typeof parsedBlobSchema>;

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const today = new Date().toISOString().split("T")[0] ?? "";
  return `You are a task parser for a productivity app. The user will paste raw notes — a mix of tasks, statuses, and context — from their workday.

Your job:
1. Split the input into individual tasks
2. Generate a SHORT clean title (max 8 words, no filler, no status markers)
3. Generate a brief description (1-2 sentences max) expanding on what the task means — infer context if obvious
4. Detect inline status from markers in the text:
   - "done", "DONE", "✓", "✅", "- done" → status: "done"
   - "in progress", "IN PROGRESS", "IN PROGGRESS" → status: "in_progress"
   - "SKIP", "skip", "INCONSEQUENTIAL" → status: "skip" (map to cancelled)
   - "TBD", "tbd" → status: "todo"
   - No marker → status: "todo"
5. Infer priority from urgency words: "urgent", "asap", "critical" → urgent; "meeting", "proposal", "client" → high; default → medium
6. Extract tags from context (e.g. "CEAS", "Wakalead", "umrah", "corporate")
7. Today is ${today}. Extract due dates only if explicitly mentioned.

Rules:
- NEVER copy the raw text as the title — always clean and shorten it
- A title like "The icp config keeps reverting…." becomes "Fix ICP config revert bug"
- A title like "Mabel account not working …DONE" becomes "Fix Mabel account issue" with status: done
- Skip items that are clearly not tasks (pure metadata, blank lines)
- If description is obvious from context, write it. If not, omit it.
- Respond ONLY with valid JSON. No markdown, no preamble, no explanation.

JSON shape (strict):
{
  "tasks": [
    {
      "title": "short clean title",
      "description": "optional 1-2 sentence description or omit key",
      "priority": "low" | "medium" | "high" | "urgent",
      "tags": ["tag1"],
      "dueDate": "YYYY-MM-DD" | null,
      "estimatedMinutes": number | null,
      "status": "todo" | "in_progress" | "done" | "cancelled" | "skip",
      "confidence": 0.0-1.0
    }
  ]
}`;
}

// ─── Strip markdown fences if the model wraps output ──────────────────────────

function extractJson(raw: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }
  return raw.trim();
}

// ─── Map internal blob schema → ParsedTaskResult[] ────────────────────────────

function mapParsedBlob(blob: ParsedBlob): ParsedTaskResult[] {
  return blob.tasks
    .filter((t) => t.status !== "skip") // skip / inconsequential → don't create a task
    .map((t) => ({
      title: t.title,
      ...(t.description !== undefined ? { description: t.description } : {}),
      priority: t.priority,
      tags: t.tags,
      dueDate: t.dueDate,
      estimatedMinutes: t.estimatedMinutes,
      status: t.status === "skip" ? "cancelled" : t.status,
      confidence: t.confidence,
    }));
}

// ─── Parse a multi-task blob — primary export ─────────────────────────────────

export async function parseMultipleTasksFromText(
  rawText: string,
): Promise<Result<ParsedTaskResult[]>> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return err({ code: "VALIDATION_ERROR", message: "Input is empty" });
  }

  let raw = "";
  try {
    const response = await createCompletion({
      model: env.AI_MODEL,
      max_tokens: 2000,
      temperature: 0.1,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: trimmed },
      ],
    });

    raw = response.choices[0]?.message?.content ?? "";
    if (!raw) {
      return err({ code: "AI_ERROR", message: "Empty response from AI parser" });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch {
      return err({ code: "AI_ERROR", message: "AI returned non-JSON output" });
    }

    const validated = parsedBlobSchema.safeParse(parsed);
    if (!validated.success) {
      logger.error("Parser schema validation failed", {
        errors: validated.error.flatten(),
        raw: extractJson(raw).slice(0, 300),
      });
      return err({
        code: "VALIDATION_ERROR",
        message: "AI returned unexpected structure",
        fields: validated.error.flatten().fieldErrors,
      });
    }

    return ok(mapParsedBlob(validated.data));
  } catch (cause) {
    logger.error("Task parsing failed", { cause, raw: raw.slice(0, 300) });
    const classified = classifyProviderError(cause);
    if (classified) return err(classified);
    return err({ code: "AI_ERROR", message: "Task parsing failed" });
  }
}

// ─── Single-task parse (back-compat wrapper) ──────────────────────────────────

export async function parseTaskFromText(rawText: string): Promise<Result<ParsedTaskResult>> {
  const result = await parseMultipleTasksFromText(rawText);
  if (!result.ok) return result;

  const first = result.value[0];
  if (!first) {
    return err({ code: "VALIDATION_ERROR", message: "No tasks found in input" });
  }
  return ok(first);
}
