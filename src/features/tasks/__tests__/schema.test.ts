import { describe, expect, it } from "vitest";

import { requestInputSchema, taskInputSchema } from "../schema";

describe("taskInputSchema", () => {
  it("accepts a minimal valid input", () => {
    const result = taskInputSchema.safeParse({
      title: "Do the thing",
      priority: "medium",
      tags: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a fully specified input", () => {
    const result = taskInputSchema.safeParse({
      title: "Ship release",
      description: "Cut the 2.0 release",
      priority: "urgent",
      tags: ["release", "eng"],
      dueDate: "2026-07-01",
      estimatedMinutes: 120,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(taskInputSchema.safeParse({ title: "", priority: "low", tags: [] }).success).toBe(false);
  });

  it("rejects an invalid priority", () => {
    expect(taskInputSchema.safeParse({ title: "x", priority: "later", tags: [] }).success).toBe(
      false,
    );
  });

  it("rejects a malformed due date", () => {
    expect(
      taskInputSchema.safeParse({ title: "x", priority: "low", tags: [], dueDate: "07/01/2026" })
        .success,
    ).toBe(false);
  });

  it("rejects more than 10 tags", () => {
    const tags = Array.from({ length: 11 }, (_, i) => `t${String(i)}`);
    expect(taskInputSchema.safeParse({ title: "x", priority: "low", tags }).success).toBe(false);
  });

  it("rejects non-positive estimated minutes", () => {
    expect(
      taskInputSchema.safeParse({ title: "x", priority: "low", tags: [], estimatedMinutes: 0 })
        .success,
    ).toBe(false);
  });
});

describe("requestInputSchema", () => {
  it("accepts a valid request", () => {
    const result = requestInputSchema.safeParse({
      title: "Fix the export bug",
      description: "CSV export drops the last row for large datasets.",
      requesterName: "Ada Lovelace",
      urgency: "high",
      desiredDeadline: "2026-06-30",
      slug: "demo",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a too-short description", () => {
    expect(
      requestInputSchema.safeParse({
        title: "x",
        description: "short",
        requesterName: "Ada",
        urgency: "low",
        slug: "demo",
      }).success,
    ).toBe(false);
  });

  it("requires a slug", () => {
    expect(
      requestInputSchema.safeParse({
        title: "x",
        description: "a description long enough",
        requesterName: "Ada",
        urgency: "low",
        slug: "",
      }).success,
    ).toBe(false);
  });
});
