import { describe, expect, it } from "vitest";

import { detectCarryovers, sortDailyTasks } from "../carryover";
import type { Task } from "../types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t",
    workspaceId: "ws-1",
    title: "Task",
    description: null,
    status: "todo",
    priority: "medium",
    tags: [],
    dueDate: null,
    dueAt: null,
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

const TODAY = new Date("2026-06-16T12:00:00.000Z");

describe("detectCarryovers", () => {
  it("flags open tasks created before today", () => {
    const task = makeTask({ id: "old", createdAt: "2026-06-14T08:00:00.000Z" });
    expect(detectCarryovers([task], TODAY)).toHaveLength(1);
  });

  it("does not flag tasks created today", () => {
    const task = makeTask({ id: "today", createdAt: "2026-06-16T01:00:00.000Z" });
    expect(detectCarryovers([task], TODAY)).toHaveLength(0);
  });

  it("excludes done and cancelled tasks regardless of age", () => {
    const done = makeTask({ id: "d", status: "done", createdAt: "2026-06-10T08:00:00.000Z" });
    const cancelled = makeTask({
      id: "c",
      status: "cancelled",
      createdAt: "2026-06-10T08:00:00.000Z",
    });
    expect(detectCarryovers([done, cancelled], TODAY)).toHaveLength(0);
  });

  it("includes in_progress tasks created before today", () => {
    const task = makeTask({
      id: "ip",
      status: "in_progress",
      createdAt: "2026-06-12T08:00:00.000Z",
    });
    expect(detectCarryovers([task], TODAY)).toHaveLength(1);
  });
});

describe("sortDailyTasks", () => {
  it("places carryovers before non-carryovers", () => {
    const fresh = makeTask({ id: "fresh", carriedOver: false });
    const carried = makeTask({ id: "carried", carriedOver: true });
    const sorted = sortDailyTasks([fresh, carried]);
    expect(sorted.map((t) => t.id)).toEqual(["carried", "fresh"]);
  });

  it("orders carryovers by carryCount descending", () => {
    const a = makeTask({ id: "a", carriedOver: true, carryCount: 1 });
    const b = makeTask({ id: "b", carriedOver: true, carryCount: 3 });
    expect(sortDailyTasks([a, b]).map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("breaks ties by priority (urgent first)", () => {
    const low = makeTask({ id: "low", priority: "low" });
    const urgent = makeTask({ id: "urgent", priority: "urgent" });
    const medium = makeTask({ id: "medium", priority: "medium" });
    expect(sortDailyTasks([low, urgent, medium]).map((t) => t.id)).toEqual([
      "urgent",
      "medium",
      "low",
    ]);
  });

  it("does not mutate the input array", () => {
    const tasks = [makeTask({ id: "x" }), makeTask({ id: "y", carriedOver: true })];
    const snapshot = tasks.map((t) => t.id);
    sortDailyTasks(tasks);
    expect(tasks.map((t) => t.id)).toEqual(snapshot);
  });
});
