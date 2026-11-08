import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ create: vi.fn() }));

// Mock the lazy OpenRouter accessor used by the parser.
vi.mock("@/lib/ai-client", () => ({
  getAiClient: () => ({ chat: { completions: { create: h.create } } }),
}));

const { parseMultipleTasksFromText, parseTaskFromText } = await import("../parser");

function mockResponse(tasks: unknown[]): void {
  h.create.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify({ tasks }) } }],
  });
}

beforeEach(() => {
  h.create.mockReset();
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

  it("tolerates a model that omits null dueDate/estimatedMinutes keys", async () => {
    // Some models (e.g. nvidia/nemotron) drop null-valued keys entirely rather
    // than emitting `null`. The schema must treat missing → null, not reject.
    mockResponse([
      {
        title: "Integrate Apify",
        priority: "medium",
        tags: ["apify"],
        status: "todo",
        confidence: 0.8,
      },
    ]);

    const result = await parseMultipleTasksFromText("integrate apify");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.dueDate).toBeNull();
    expect(result.value[0]?.estimatedMinutes).toBeNull();
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
    h.create.mockResolvedValueOnce({ choices: [{ message: { content: "" } }] });
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
    h.create.mockResolvedValueOnce({
      choices: [{ message: { content: `\`\`\`json\n${JSON.stringify({ tasks })}\n\`\`\`` } }],
    });

    const result = await parseMultipleTasksFromText("Meeting with corp sales");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.title).toBe("Meeting with corp sales");
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

  it("returns VALIDATION_ERROR when the model returns an unexpected structure", async () => {
    h.create.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ notTasks: [] }) } }],
    });
    const result = await parseMultipleTasksFromText("something");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns AI_ERROR on non-JSON output", async () => {
    h.create.mockResolvedValueOnce({
      choices: [{ message: { content: "sorry, I can't do that" } }],
    });
    const result = await parseMultipleTasksFromText("something");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("AI_ERROR");
  });

  it("returns AI_ERROR when the client throws", async () => {
    h.create.mockRejectedValueOnce(new Error("network down"));
    const result = await parseMultipleTasksFromText("something");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("AI_ERROR");
  });
});

describe("parseTaskFromText — back-compat wrapper", () => {
  it("returns the first parsed task", async () => {
    mockResponse([
      {
        title: "First",
        priority: "medium",
        tags: [],
        dueDate: null,
        estimatedMinutes: null,
        status: "todo",
        confidence: 0.9,
      },
      {
        title: "Second",
        priority: "low",
        tags: [],
        dueDate: null,
        estimatedMinutes: null,
        status: "todo",
        confidence: 0.7,
      },
    ]);
    const result = await parseTaskFromText("two things");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe("First");
  });

  it("returns VALIDATION_ERROR when only skipped items remain", async () => {
    mockResponse([
      {
        title: "Ignore me",
        priority: "low",
        tags: [],
        dueDate: null,
        estimatedMinutes: null,
        status: "skip",
        confidence: 0.9,
      },
    ]);
    const result = await parseTaskFromText("nothing to do - SKIP");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("propagates parser errors", async () => {
    const result = await parseTaskFromText("   ");
    expect(result.ok).toBe(false);
  });
});
