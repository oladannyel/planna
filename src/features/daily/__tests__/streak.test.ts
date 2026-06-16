import { describe, expect, it } from "vitest";

import type { Task } from "@/features/tasks/types";

import { completedDates, computeCurrentStreak } from "../streak";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t",
    workspaceId: "ws-1",
    title: "t",
    description: null,
    status: "todo",
    priority: "medium",
    tags: [],
    dueDate: null,
    estimatedMinutes: null,
    source: "manual",
    requestedBy: null,
    carriedOver: false,
    carryCount: 0,
    statusHistory: [],
    completedAt: null,
    createdAt: "2026-06-16T09:00:00.000Z",
    updatedAt: "2026-06-16T09:00:00.000Z",
    ...overrides,
  };
}

describe("completedDates", () => {
  it("returns ISO dates only for completed tasks", () => {
    const tasks = [
      makeTask({ id: "a", status: "done", completedAt: "2026-06-16T10:00:00.000Z" }),
      makeTask({ id: "b", status: "todo" }),
      makeTask({ id: "c", status: "done", completedAt: null }),
    ];
    expect(completedDates(tasks)).toEqual(["2026-06-16"]);
  });
});

describe("computeCurrentStreak", () => {
  const today = new Date("2026-06-16T12:00:00.000Z");

  it("is 0 when nothing was completed today", () => {
    expect(computeCurrentStreak(["2026-06-14"], today)).toBe(0);
  });

  it("counts a single day", () => {
    expect(computeCurrentStreak(["2026-06-16"], today)).toBe(1);
  });

  it("counts consecutive days back from today", () => {
    expect(computeCurrentStreak(["2026-06-16", "2026-06-15", "2026-06-14"], today)).toBe(3);
  });

  it("stops at the first gap", () => {
    expect(computeCurrentStreak(["2026-06-16", "2026-06-14"], today)).toBe(1);
  });

  it("ignores duplicate dates", () => {
    expect(computeCurrentStreak(["2026-06-16", "2026-06-16", "2026-06-15"], today)).toBe(2);
  });
});
