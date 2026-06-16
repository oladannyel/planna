import { describe, expect, it } from "vitest";

import type { Task } from "@/features/tasks/types";

import { bucketByDay, getWeekStart, resolveWeekStart, shiftWeek, weekDays } from "../week";

function makeTask(id: string, dueDate: string | null): Task {
  return {
    id,
    workspaceId: "ws-1",
    title: id,
    description: null,
    status: "todo",
    priority: "medium",
    tags: [],
    dueDate,
    estimatedMinutes: null,
    source: "manual",
    requestedBy: null,
    carriedOver: false,
    carryCount: 0,
    statusHistory: [],
    completedAt: null,
    createdAt: "2026-06-16T09:00:00.000Z",
    updatedAt: "2026-06-16T09:00:00.000Z",
  };
}

describe("getWeekStart", () => {
  it("anchors to Monday", () => {
    // 2026-06-16 is a Tuesday.
    expect(getWeekStart(new Date("2026-06-16T12:00:00"))).toBe("2026-06-15");
  });
});

describe("resolveWeekStart", () => {
  const today = new Date("2026-06-16T12:00:00");

  it("uses a valid week param", () => {
    expect(resolveWeekStart("2026-07-01", today)).toBe("2026-06-29");
  });

  it("falls back to the current week for an invalid param", () => {
    expect(resolveWeekStart("nonsense", today)).toBe("2026-06-15");
  });

  it("falls back when the param is absent", () => {
    expect(resolveWeekStart(undefined, today)).toBe("2026-06-15");
  });
});

describe("weekDays", () => {
  it("returns 7 days Mon→Sun", () => {
    const days = weekDays("2026-06-15");
    expect(days).toHaveLength(7);
    expect(days[0]?.date).toBe("2026-06-15");
    expect(days[0]?.weekday).toBe("Mon");
    expect(days[6]?.date).toBe("2026-06-21");
    expect(days[6]?.weekday).toBe("Sun");
  });
});

describe("shiftWeek", () => {
  it("moves forward and backward by whole weeks", () => {
    expect(shiftWeek("2026-06-15", 1)).toBe("2026-06-22");
    expect(shiftWeek("2026-06-15", -1)).toBe("2026-06-08");
  });
});

describe("bucketByDay", () => {
  it("groups tasks by due date and ignores out-of-range/undated", () => {
    const days = weekDays("2026-06-15");
    const tasks = [
      makeTask("a", "2026-06-15"),
      makeTask("b", "2026-06-15"),
      makeTask("c", "2026-06-18"),
      makeTask("d", null),
      makeTask("e", "2026-07-01"), // outside the week
    ];
    const buckets = bucketByDay(tasks, days);
    expect(buckets["2026-06-15"]).toHaveLength(2);
    expect(buckets["2026-06-18"]).toHaveLength(1);
    expect(buckets["2026-06-16"]).toHaveLength(0);
    expect(Object.values(buckets).flat()).toHaveLength(3);
  });
});
