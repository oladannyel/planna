import { describe, expect, it } from "vitest";

import { daysOld, detectCarryovers, groupByAge, sortDailyTasks, taskAge } from "../carryover";
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

describe("daysOld", () => {
  it("counts a task created today as zero days old", () => {
    expect(daysOld(makeTask({ createdAt: "2026-06-16T01:00:00.000Z" }), TODAY)).toBe(0);
  });

  it("counts calendar days, not elapsed hours", () => {
    /*
     * Built in local time on purpose: 23:50 "last night" is only ten minutes
     * before a 00:00 boundary, so a UTC literal here would land on either
     * side of it depending on the machine's timezone.
     */
    const lastNight = new Date(2026, 5, 15, 23, 50).toISOString();
    const justAfterMidnight = new Date(2026, 5, 16, 0, 0).toISOString();
    expect(daysOld(makeTask({ createdAt: lastNight }), new Date(2026, 5, 16, 12))).toBe(1);
    expect(daysOld(makeTask({ createdAt: justAfterMidnight }), new Date(2026, 5, 16, 12))).toBe(0);
  });

  it("counts multiple days back", () => {
    expect(daysOld(makeTask({ createdAt: "2026-06-11T08:00:00.000Z" }), TODAY)).toBe(5);
  });

  it("never reports a negative age for a future timestamp", () => {
    expect(daysOld(makeTask({ createdAt: "2026-06-20T08:00:00.000Z" }), TODAY)).toBe(0);
  });

  it("falls back to zero for an unparseable timestamp", () => {
    expect(daysOld(makeTask({ createdAt: "not a date" }), TODAY)).toBe(0);
  });
});

describe("taskAge", () => {
  it("classifies today, yesterday and older", () => {
    expect(taskAge(makeTask({ createdAt: "2026-06-16T09:00:00.000Z" }), TODAY)).toBe("today");
    expect(taskAge(makeTask({ createdAt: "2026-06-15T09:00:00.000Z" }), TODAY)).toBe("yesterday");
    expect(taskAge(makeTask({ createdAt: "2026-06-13T09:00:00.000Z" }), TODAY)).toBe("older");
  });

  it("classifies by creation day regardless of status", () => {
    const done = makeTask({ status: "done", createdAt: "2026-06-10T09:00:00.000Z" });
    expect(taskAge(done, TODAY)).toBe("older");
  });
});

describe("groupByAge", () => {
  it("puts every task in exactly one bucket", () => {
    const tasks = [
      makeTask({ id: "a", createdAt: "2026-06-16T09:00:00.000Z" }),
      makeTask({ id: "b", createdAt: "2026-06-15T09:00:00.000Z" }),
      makeTask({ id: "c", createdAt: "2026-06-01T09:00:00.000Z" }),
      makeTask({ id: "d", createdAt: "2026-06-16T23:00:00.000Z" }),
    ];
    const groups = groupByAge(tasks, TODAY);
    expect(groups.today.map((t) => t.id)).toEqual(["a", "d"]);
    expect(groups.yesterday.map((t) => t.id)).toEqual(["b"]);
    expect(groups.older.map((t) => t.id)).toEqual(["c"]);
    const total = groups.today.length + groups.yesterday.length + groups.older.length;
    expect(total).toBe(tasks.length);
  });

  it("returns empty buckets rather than missing keys", () => {
    const groups = groupByAge([], TODAY);
    expect(groups).toEqual({ today: [], yesterday: [], older: [] });
  });
});
