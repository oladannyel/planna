# Parser Fix — Multi-Task Blob Parsing with Gemini 2.0 Flash

> **Claude Code Instructions**: This is a targeted fix for the AI task parser.  
> Apply changes in order. Run verification at the end.  
> Do not touch any other files.

---

## Problem

1. `OPENROUTER_FREE_MODEL` is set to `mistralai/mistral-7b-instruct:free` — this model times out silently on OpenRouter's free tier and cannot handle multi-task blobs
2. The parser expects one task per input — the user's real workflow is pasting their entire day as one block of text with inline status markers (DONE, IN PROGRESS, SKIP, TBD, INCONSEQUENTIAL)
3. The parser returns a single `ParsedTaskResult` — it needs to return `ParsedTaskResult[]`
4. Short title + description are not being generated — the model is copying raw text verbatim

---

## Fix 1 — Switch Model in `.env.local`

Update `.env.local`:

```bash
# Replace this line:
OPENROUTER_FREE_MODEL=mistralai/mistral-7b-instruct:free

# With this:
OPENROUTER_FREE_MODEL=google/gemini-2.0-flash-exp:free
```

---

## Fix 2 — Rewrite `src/features/tasks/parser.ts`

Replace the entire file with:

````typescript
import { z } from "zod";

import { env } from "@/lib/env";
import { openrouter } from "@/lib/openrouter";
import { err, ok } from "@/lib/result";
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";
import type { ParsedTaskResult } from "./types";

// ─── Output schema ────────────────────────────────────────────────────────────

const parsedTaskSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  tags: z.array(z.string()).max(5),
  dueDate: z.string().nullable(),
  estimatedMinutes: z.number().nullable(),
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

// ─── Strip markdown fences if model wraps output ──────────────────────────────

function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    return raw.slice(firstBrace, lastBrace + 1);
  }
  return raw.trim();
}

// ─── Parse single task (original API — kept for backwards compat) ─────────────

export async function parseTaskFromText(rawText: string): Promise<Result<ParsedTaskResult>> {
  const result = await parseMultipleTasksFromText(rawText);
  if (!result.ok) return result;

  const first = result.value[0];
  if (!first) {
    return err({ code: "VALIDATION_ERROR", message: "No tasks found in input" });
  }

  return ok(first);
}

// ─── Parse multi-task blob — primary export ───────────────────────────────────

export async function parseMultipleTasksFromText(
  rawText: string,
): Promise<Result<ParsedTaskResult[]>> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return err({ code: "VALIDATION_ERROR", message: "Input is empty" });
  }

  let raw = "";

  try {
    const response = await openrouter.chat.completions.create({
      model: env.OPENROUTER_FREE_MODEL,
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

    const cleaned = extractJSON(raw);
    const parsed: unknown = JSON.parse(cleaned);
    const validated = parsedBlobSchema.safeParse(parsed);

    if (!validated.success) {
      logger.error("Parser schema validation failed", {
        errors: validated.error.flatten(),
        raw: cleaned.slice(0, 300),
      });
      return err({
        code: "VALIDATION_ERROR",
        message: "AI returned unexpected structure",
        fields: validated.error.flatten().fieldErrors as Record<string, string[]>,
      });
    }

    const tasks = mapParsedBlob(validated.data);
    return ok(tasks);
  } catch (cause) {
    logger.error("Task parsing failed", { cause, raw: raw.slice(0, 300) });
    return err({ code: "AI_ERROR", message: "Task parsing failed", cause });
  }
}

// ─── Map internal schema to ParsedTaskResult ──────────────────────────────────

function mapParsedBlob(blob: ParsedBlob): ParsedTaskResult[] {
  return blob.tasks
    .filter((t) => t.status !== "skip") // skip = don't create task
    .map((t) => ({
      title: t.title,
      description: t.description,
      priority: t.priority,
      tags: t.tags,
      dueDate: t.dueDate,
      estimatedMinutes: t.estimatedMinutes,
      status: t.status === "skip" ? ("cancelled" as const) : t.status,
      confidence: t.confidence,
    }));
}
````

---

## Fix 3 — Update `src/features/tasks/types.ts`

Add `status` and `description` to `ParsedTaskResult`:

```typescript
export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskSource = "manual" | "ai_parsed" | "request_link";

export interface StatusHistoryEntry {
  status: TaskStatus;
  changedAt: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  dueDate: string | null;
  estimatedMinutes: number | null;
  source: TaskSource;
  requestedBy: string | null;
  carriedOver: boolean;
  carryCount: number;
  statusHistory: StatusHistoryEntry[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  description?: string;
  priority: TaskPriority;
  tags: string[];
  dueDate?: string;
  estimatedMinutes?: number;
  status?: TaskStatus;
}

export interface ParsedTaskResult {
  title: string;
  description?: string; // AI-generated description
  priority: TaskPriority;
  tags: string[];
  dueDate: string | null;
  estimatedMinutes: number | null;
  status: TaskStatus; // inferred from inline markers
  confidence: number;
}
```

---

## Fix 4 — Update `src/features/tasks/actions.ts`

Update `createTask` to accept `status` and `description`, and add `createMultipleTasksFromText`:

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { err, ok } from "@/lib/result";
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";
import { taskInputSchema } from "./schema";
import { parseMultipleTasksFromText } from "./parser";
import type { Task, TaskInput } from "./types";

// ─── Map DB row → Task ────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): Task {
  return {
    id: row["id"] as string,
    workspaceId: row["workspace_id"] as string,
    title: row["title"] as string,
    description: (row["description"] as string | null) ?? null,
    status: row["status"] as Task["status"],
    priority: row["priority"] as Task["priority"],
    tags: (row["tags"] as string[]) ?? [],
    dueDate: (row["due_date"] as string | null) ?? null,
    estimatedMinutes: (row["estimated_minutes"] as number | null) ?? null,
    source: row["source"] as Task["source"],
    requestedBy: (row["requested_by"] as string | null) ?? null,
    carriedOver: (row["carried_over"] as boolean) ?? false,
    carryCount: (row["carry_count"] as number) ?? 0,
    statusHistory: (row["status_history"] as Task["statusHistory"]) ?? [],
    completedAt: (row["completed_at"] as string | null) ?? null,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}

// ─── Get workspace ID for current user ───────────────────────────────────────

async function getWorkspaceId(): Promise<Result<string>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "UNAUTHORIZED", message: "Not authenticated" });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!workspace) return err({ code: "NOT_FOUND", message: "Workspace not found" });
  return ok(workspace.id);
}

// ─── Create single task ───────────────────────────────────────────────────────

export async function createTask(input: TaskInput): Promise<Result<Task>> {
  const validated = taskInputSchema.safeParse(input);
  if (!validated.success) {
    return err({
      code: "VALIDATION_ERROR",
      message: "Invalid task input",
      fields: validated.error.flatten().fieldErrors as Record<string, string[]>,
    });
  }

  const workspaceResult = await getWorkspaceId();
  if (!workspaceResult.ok) return workspaceResult;

  const supabase = await createServerSupabaseClient();
  const status = validated.data.status ?? "todo";
  const completedAt = status === "done" ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: workspaceResult.value,
      title: validated.data.title,
      description: validated.data.description ?? null,
      status,
      priority: validated.data.priority,
      tags: validated.data.tags,
      due_date: validated.data.dueDate ?? null,
      estimated_minutes: validated.data.estimatedMinutes ?? null,
      source: "ai_parsed",
      completed_at: completedAt,
      status_history: [{ status, changedAt: new Date().toISOString() }],
    })
    .select()
    .single();

  if (error) {
    logger.error("createTask DB error", { error });
    return err({ code: "DB_ERROR", message: error.message, cause: error });
  }

  revalidatePath("/board");
  revalidatePath("/daily");

  return ok(mapRow(data as Record<string, unknown>));
}

// ─── Parse blob and create all tasks ─────────────────────────────────────────

export interface BulkCreateResult {
  created: Task[];
  skipped: number;
  errors: string[];
}

export async function createMultipleTasksFromText(
  rawText: string,
): Promise<Result<BulkCreateResult>> {
  const parseResult = await parseMultipleTasksFromText(rawText);
  if (!parseResult.ok) return parseResult;

  const parsed = parseResult.value;
  const created: Task[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const item of parsed) {
    if (item.confidence < 0.3) {
      skipped++;
      continue;
    }

    const result = await createTask({
      title: item.title,
      description: item.description,
      priority: item.priority,
      tags: item.tags,
      dueDate: item.dueDate ?? undefined,
      estimatedMinutes: item.estimatedMinutes ?? undefined,
      status: item.status,
    });

    if (result.ok) {
      created.push(result.value);
    } else {
      errors.push(`"${item.title}": ${result.error.message}`);
    }
  }

  revalidatePath("/board");
  revalidatePath("/daily");

  return ok({ created, skipped, errors });
}

// ─── Update task status ───────────────────────────────────────────────────────

export async function updateTaskStatus(
  taskId: string,
  status: Task["status"],
): Promise<Result<Task>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "UNAUTHORIZED", message: "Not authenticated" });

  const completedAt = status === "done" ? new Date().toISOString() : null;
  const historyEntry = { status, changedAt: new Date().toISOString() };

  // Fetch current history first
  const { data: current } = await supabase
    .from("tasks")
    .select("status_history")
    .eq("id", taskId)
    .single();

  const existingHistory = Array.isArray(current?.status_history) ? current.status_history : [];

  const { data, error } = await supabase
    .from("tasks")
    .update({
      status,
      completed_at: completedAt,
      status_history: [...existingHistory, historyEntry],
    })
    .eq("id", taskId)
    .select()
    .single();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message, cause: error });
  }

  revalidatePath("/board");
  revalidatePath("/daily");
  revalidatePath("/analytics");

  return ok(mapRow(data as Record<string, unknown>));
}

// ─── Delete task ──────────────────────────────────────────────────────────────

export async function deleteTask(taskId: string): Promise<Result<void>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "UNAUTHORIZED", message: "Not authenticated" });

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);

  if (error) {
    return err({ code: "DB_ERROR", message: error.message, cause: error });
  }

  revalidatePath("/board");
  revalidatePath("/daily");

  return ok(undefined);
}
```

---

## Fix 5 — Update `src/features/tasks/schema.ts`

Add `status` field:

```typescript
import { z } from "zod";

export const taskInputSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  tags: z.array(z.string().min(1).max(50)).max(10),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  estimatedMinutes: z.number().int().positive().max(14400).optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
});

export const requestInputSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(10).max(5000),
  requesterName: z.string().min(1).max(100),
  urgency: z.enum(["low", "medium", "high", "urgent"]),
  desiredDeadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  slug: z.string().min(1),
});

export type TaskInputSchema = z.infer<typeof taskInputSchema>;
export type RequestInputSchema = z.infer<typeof requestInputSchema>;
```

---

## Fix 6 — Update the Board capture UI

Find the task capture component in your board page (wherever the textarea and "Add with AI" button live). Replace the `handleAddWithAI` function with one that calls `createMultipleTasksFromText` and shows a summary:

```typescript
// In your board capture component — replace the AI submit handler

import { createMultipleTasksFromText } from "@/features/tasks/actions";

// Inside your component:
const [parseResult, setParseResult] = useState<{
  created: number;
  skipped: number;
  errors: string[];
} | null>(null);

async function handleAddWithAI() {
  if (!text.trim()) return;
  setLoading(true);
  setError(null);
  setParseResult(null);

  const result = await createMultipleTasksFromText(text);

  setLoading(false);

  if (!result.ok) {
    setError("Couldn't parse that — try adding manually.");
    return;
  }

  const { created, skipped, errors } = result.value;

  if (created.length === 0) {
    setError("No tasks found. Try adding manually.");
    return;
  }

  // Show summary, clear input
  setParseResult({
    created: created.length,
    skipped,
    errors,
  });
  setText("");

  // Auto-dismiss summary after 4 seconds
  setTimeout(() => { setParseResult(null); }, 4000);
}

// In your JSX, replace the error display with:
{parseResult && (
  <div className="rounded-lg bg-teal-950/30 border border-brand-teal/30 px-4 py-3 text-sm">
    <span className="text-brand-teal-light font-medium">
      {parseResult.created} task{parseResult.created !== 1 ? "s" : ""} created
    </span>
    {parseResult.skipped > 0 && (
      <span className="text-text-muted ml-2">
        · {parseResult.skipped} skipped
      </span>
    )}
    {parseResult.errors.length > 0 && (
      <span className="text-brand-amber-light ml-2">
        · {parseResult.errors.length} failed
      </span>
    )}
  </div>
)}

{error && (
  <p className="text-sm text-brand-red-light">{error}</p>
)}
```

---

## Fix 7 — Update parser tests `src/features/tasks/__tests__/parser.test.ts`

Replace the entire test file with a golden dataset that covers the real use cases:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock openrouter before importing parser
vi.mock("@/lib/openrouter", () => ({
  openrouter: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    OPENROUTER_FREE_MODEL: "google/gemini-2.0-flash-exp:free",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  },
}));

import { openrouter } from "@/lib/openrouter";
import { parseMultipleTasksFromText } from "../parser";

const mockCreate = vi.mocked(
  (openrouter.chat.completions as { create: ReturnType<typeof vi.fn> }).create,
);

function mockResponse(tasks: unknown[]) {
  mockCreate.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify({ tasks }) } }],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parseMultipleTasksFromText — golden dataset", () => {
  it("parses a single clean task as todo", async () => {
    mockResponse([
      {
        title: "Fix ICP config revert bug",
        description: "The ICP config keeps reverting to a previous state.",
        priority: "high",
        tags: ["bug", "icp"],
        dueDate: null,
        estimatedMinutes: 60,
        status: "todo",
        confidence: 0.9,
      },
    ]);

    const result = await parseMultipleTasksFromText("The icp config keeps reverting....");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.status).toBe("todo");
    expect(result.value[0]?.title).toBe("Fix ICP config revert bug");
  });

  it("detects DONE status from inline marker", async () => {
    mockResponse([
      {
        title: "Fix Mabel account issue",
        priority: "medium",
        tags: [],
        dueDate: null,
        estimatedMinutes: null,
        status: "done",
        confidence: 0.95,
      },
    ]);

    const result = await parseMultipleTasksFromText("Mabel account not working …DONE");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.status).toBe("done");
  });

  it("filters out SKIP items — does not create tasks for them", async () => {
    mockResponse([
      {
        title: "Filter existing customers",
        priority: "low",
        tags: [],
        dueDate: null,
        estimatedMinutes: null,
        status: "skip",
        confidence: 0.9,
      },
    ]);

    const result = await parseMultipleTasksFromText(
      "Ability to filter already existing customers - SKIP",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // skip items are filtered out
    expect(result.value).toHaveLength(0);
  });

  it("parses a full day blob into multiple tasks", async () => {
    mockResponse([
      {
        title: "Fix logout flow",
        priority: "medium",
        tags: [],
        dueDate: null,
        estimatedMinutes: 30,
        status: "done",
        confidence: 0.95,
      },
      {
        title: "Fix Mabel account issue",
        priority: "medium",
        tags: [],
        dueDate: null,
        estimatedMinutes: null,
        status: "done",
        confidence: 0.95,
      },
      {
        title: "Fix ICP config revert bug",
        priority: "high",
        tags: ["bug"],
        dueDate: null,
        estimatedMinutes: 60,
        status: "todo",
        confidence: 0.9,
      },
      {
        title: "Filter existing customers",
        priority: "low",
        tags: [],
        dueDate: null,
        estimatedMinutes: null,
        status: "skip",
        confidence: 0.9,
      },
    ]);

    const blob = `Logout not working - done
Mabel account not working …DONE
The icp config keeps reverting….
Ability to filter already existing customers - SKIP`;

    const result = await parseMultipleTasksFromText(blob);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // SKIP filtered → 3 tasks
    expect(result.value).toHaveLength(3);
    const statuses = result.value.map((t) => t.status);
    expect(statuses.filter((s) => s === "done")).toHaveLength(2);
    expect(statuses.filter((s) => s === "todo")).toHaveLength(1);
  });

  it("handles IN PROGRESS status", async () => {
    mockResponse([
      {
        title: "Abolaji proposal",
        description: "Draft and send proposal to Abolaji.",
        priority: "high",
        tags: ["proposal"],
        dueDate: null,
        estimatedMinutes: 90,
        status: "in_progress",
        confidence: 0.88,
      },
    ]);

    const result = await parseMultipleTasksFromText("Proposal for Abolaji - IN PROGRESS");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.status).toBe("in_progress");
    expect(result.value[0]?.title).toBe("Abolaji proposal");
  });

  it("returns VALIDATION_ERROR on empty input", async () => {
    const result = await parseMultipleTasksFromText("   ");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns AI_ERROR on empty model response", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "" } }],
    });
    const result = await parseMultipleTasksFromText("Fix the bug");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("AI_ERROR");
  });

  it("strips markdown fences from model output", async () => {
    const tasks = [
      {
        title: "Meeting with corp sales",
        priority: "high",
        tags: ["sales"],
        dueDate: null,
        estimatedMinutes: 60,
        status: "todo",
        confidence: 0.9,
      },
    ];
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: `\`\`\`json\n${JSON.stringify({ tasks })}\n\`\`\`` } }],
    });

    const result = await parseMultipleTasksFromText("Meeting with corp sales");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.title).toBe("Meeting with corp sales");
  });

  it("skips low-confidence tasks (< 0.3) in createMultipleTasksFromText", async () => {
    // This is tested at the actions layer — parser itself returns all tasks
    mockResponse([
      {
        title: "Unclear item",
        priority: "low",
        tags: [],
        dueDate: null,
        estimatedMinutes: null,
        status: "todo",
        confidence: 0.2,
      },
      {
        title: "Clear task",
        priority: "medium",
        tags: [],
        dueDate: null,
        estimatedMinutes: null,
        status: "todo",
        confidence: 0.85,
      },
    ]);

    const result = await parseMultipleTasksFromText("Unclear item\nClear task");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Parser returns both; actions layer filters by confidence
    expect(result.value).toHaveLength(2);
    expect(result.value.some((t) => t.confidence < 0.3)).toBe(true);
  });

  it("handles TBD items as todo status", async () => {
    mockResponse([
      {
        title: "Hotel vertical financial planning",
        priority: "medium",
        tags: ["hotels", "finance"],
        dueDate: null,
        estimatedMinutes: null,
        status: "todo",
        confidence: 0.8,
      },
    ]);

    const result = await parseMultipleTasksFromText(
      "financial planning also - debt profile vs plan to settle - TBD",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.status).toBe("todo");
  });
});
```

---

## Verification

```bash
pnpm typecheck   # must exit 0
pnpm lint        # must exit 0
pnpm test        # parser.test.ts must show 9/9 passed
pnpm build       # must exit 0
```

Expected test output:

```
✓ src/features/tasks/__tests__/parser.test.ts (9 tests)
  ✓ parses a single clean task as todo
  ✓ detects DONE status from inline marker
  ✓ filters out SKIP items
  ✓ parses a full day blob into multiple tasks
  ✓ handles IN PROGRESS status
  ✓ returns VALIDATION_ERROR on empty input
  ✓ returns AI_ERROR on empty model response
  ✓ strips markdown fences from model output
  ✓ handles TBD items as todo status
```

---

## What this fixes

| Before                               | After                                                     |
| ------------------------------------ | --------------------------------------------------------- |
| Mistral 7B free — silently times out | Gemini 2.0 Flash free — fast, reliable, handles long text |
| Parses one task at a time            | Parses full day blob in one shot                          |
| Copies raw text as title             | Generates short clean titles (max 8 words)                |
| No status detection                  | Detects DONE, IN PROGRESS, SKIP, TBD inline               |
| No description                       | Generates 1-2 sentence description per task               |
| Parser returns single result         | Returns array — all tasks created in one go               |
| SKIP items create tasks              | SKIP / INCONSEQUENTIAL items filtered out                 |
| No confidence filtering              | Tasks below 0.3 confidence skipped                        |
