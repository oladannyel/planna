import { describe, expect, it } from "vitest";

import type { Task } from "@/features/tasks/types";

import {
  avgCycleTimeHours,
  bestStreak,
  carryoverRate,
  categoryBreakdown,
  completionRate,
  cycleTimes,
  isOnTime,
  monthlyStats,
  onTimeRate,
  tasksPerDay,
  topTags,
} from "../metrics";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: Math.random().toString(36).slice(2),
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

describe("rates", () => {
  it("completionRate is done/total as a percentage", () => {
    const tasks = [
      makeTask({ status: "done" }),
      makeTask(),
      makeTask({ status: "done" }),
      makeTask(),
    ];
    expect(completionRate(tasks)).toBe(50);
  });

  it("returns 0 for empty input (no divide-by-zero)", () => {
    expect(completionRate([])).toBe(0);
    expect(onTimeRate([])).toBe(0);
    expect(carryoverRate([])).toBe(0);
    expect(avgCycleTimeHours([])).toBe(0);
  });

  it("carryoverRate counts carriedOver tasks", () => {
    expect(carryoverRate([makeTask({ carriedOver: true }), makeTask()])).toBe(50);
  });
});

describe("isOnTime / onTimeRate", () => {
  it("flags completion before the due date end-of-day", () => {
    const onTimeTask = makeTask({
      status: "done",
      dueDate: "2026-06-20",
      completedAt: "2026-06-20T10:00:00.000Z",
    });
    const lateTask = makeTask({
      status: "done",
      dueDate: "2026-06-20",
      completedAt: "2026-06-21T10:00:00.000Z",
    });
    expect(isOnTime(onTimeTask)).toBe(true);
    expect(isOnTime(lateTask)).toBe(false);
    expect(onTimeRate([onTimeTask, lateTask])).toBe(50);
  });

  it("is false without a due date or completion", () => {
    expect(isOnTime(makeTask({ status: "done", completedAt: "2026-06-20T10:00:00.000Z" }))).toBe(
      false,
    );
    expect(isOnTime(makeTask({ status: "todo" }))).toBe(false);
  });
});

describe("avgCycleTimeHours", () => {
  it("averages create→complete hours for done tasks", () => {
    const tasks = [
      makeTask({
        status: "done",
        createdAt: "2026-06-16T00:00:00.000Z",
        completedAt: "2026-06-16T10:00:00.000Z",
      }),
      makeTask({
        status: "done",
        createdAt: "2026-06-16T00:00:00.000Z",
        completedAt: "2026-06-16T20:00:00.000Z",
      }),
    ];
    expect(avgCycleTimeHours(tasks)).toBe(15);
  });
});

describe("categoryBreakdown / topTags", () => {
  it("counts tags and sorts by frequency then name", () => {
    const tasks = [
      makeTask({ tags: ["a", "b"] }),
      makeTask({ tags: ["a"] }),
      makeTask({ tags: ["c", "b"] }),
    ];
    expect(categoryBreakdown(tasks)).toEqual([
      { tag: "a", count: 2 },
      { tag: "b", count: 2 },
      { tag: "c", count: 1 },
    ]);
  });

  it("topTags limits the result", () => {
    const tasks = [makeTask({ tags: ["a", "b", "c", "d", "e", "f"] })];
    expect(topTags(tasks, 3)).toHaveLength(3);
  });
});

describe("tasksPerDay", () => {
  it("buckets created and completed counts by day", () => {
    const tasks = [
      makeTask({ createdAt: "2026-06-15T09:00:00.000Z" }),
      makeTask({
        createdAt: "2026-06-15T09:00:00.000Z",
        status: "done",
        completedAt: "2026-06-16T09:00:00.000Z",
      }),
    ];
    const result = tasksPerDay(tasks, ["2026-06-15", "2026-06-16"]);
    expect(result).toEqual([
      { date: "2026-06-15", created: 2, completed: 0 },
      { date: "2026-06-16", created: 0, completed: 1 },
    ]);
  });
});

describe("cycleTimes", () => {
  it("returns recent completed tasks chronologically with truncated labels", () => {
    const tasks = [
      makeTask({
        title: "Older task",
        status: "done",
        createdAt: "2026-06-10T00:00:00.000Z",
        completedAt: "2026-06-10T05:00:00.000Z",
      }),
      makeTask({
        title: "A very long task title that should be truncated nicely",
        status: "done",
        createdAt: "2026-06-12T00:00:00.000Z",
        completedAt: "2026-06-12T02:00:00.000Z",
      }),
    ];
    const points = cycleTimes(tasks);
    expect(points).toHaveLength(2);
    expect(points[0]?.label).toBe("Older task");
    expect(points[0]?.hours).toBe(5);
    expect(points[1]?.label.endsWith("…")).toBe(true);
  });

  it("respects the limit", () => {
    const tasks = Array.from({ length: 15 }, (_, i) =>
      makeTask({
        status: "done",
        completedAt: `2026-06-${String(10 + (i % 19)).padStart(2, "0")}T05:00:00.000Z`,
      }),
    );
    expect(cycleTimes(tasks, 5)).toHaveLength(5);
  });
});

describe("bestStreak", () => {
  it("finds the longest consecutive run of completion days", () => {
    const done = (iso: string) => makeTask({ status: "done", completedAt: iso });
    const tasks = [
      done("2026-06-10T09:00:00.000Z"),
      done("2026-06-11T09:00:00.000Z"),
      done("2026-06-12T09:00:00.000Z"),
      done("2026-06-15T09:00:00.000Z"), // gap then restart
    ];
    expect(bestStreak(tasks)).toBe(3);
  });

  it("is 0 with no completions", () => {
    expect(bestStreak([makeTask()])).toBe(0);
  });
});

describe("monthlyStats", () => {
  it("assembles the persisted stats shape", () => {
    const tasks = [
      makeTask({ status: "done", completedAt: "2026-06-16T10:00:00.000Z", tags: ["x"] }),
      makeTask({ carriedOver: true }),
    ];
    const stats = monthlyStats(tasks);
    expect(stats.totalCreated).toBe(2);
    expect(stats.totalCompleted).toBe(1);
    expect(stats.totalCarried).toBe(1);
    expect(stats.completionRate).toBe(50);
    expect(stats.topTags).toEqual([{ tag: "x", count: 1 }]);
  });
});
