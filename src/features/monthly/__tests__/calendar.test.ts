import { describe, expect, it } from "vitest";

import type { Task } from "@/features/tasks/types";

import { dayDots, monthGrid, monthLabel, monthParam, resolveMonth, shiftMonth } from "../calendar";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: Math.random().toString(36).slice(2),
    workspaceId: "ws-1",
    title: "t",
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

describe("resolveMonth", () => {
  const today = new Date("2026-06-16T12:00:00");

  it("parses a valid YYYY-MM param", () => {
    expect(resolveMonth("2026-09", today)).toEqual({ year: 2026, month: 9 });
  });

  it("falls back to the current month on invalid/absent param", () => {
    expect(resolveMonth("bad", today)).toEqual({ year: 2026, month: 6 });
    expect(resolveMonth(undefined, today)).toEqual({ year: 2026, month: 6 });
  });
});

describe("monthParam / monthLabel", () => {
  it("zero-pads the month param", () => {
    expect(monthParam({ year: 2026, month: 3 })).toBe("2026-03");
  });

  it("formats a human label", () => {
    expect(monthLabel({ year: 2026, month: 6 })).toBe("June 2026");
  });
});

describe("shiftMonth", () => {
  it("moves within a year", () => {
    expect(shiftMonth({ year: 2026, month: 6 }, 1)).toEqual({ year: 2026, month: 7 });
  });

  it("crosses year boundaries", () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });
});

describe("monthGrid", () => {
  it("returns full Mon→Sun weeks covering the month", () => {
    // June 2026: 1st is a Monday, 30 days → exactly 5 weeks (35 cells).
    const weeks = monthGrid({ year: 2026, month: 6 });
    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]?.[0]).toEqual({ date: "2026-06-01", day: 1, inMonth: true });
  });

  it("flags leading/trailing days as out of month", () => {
    // July 2026: 1st is a Wednesday → leading Mon/Tue belong to June.
    const weeks = monthGrid({ year: 2026, month: 7 });
    const firstCell = weeks[0]?.[0];
    expect(firstCell?.inMonth).toBe(false);
    expect(firstCell?.date).toBe("2026-06-29");
  });
});

describe("dayDots", () => {
  const today = new Date("2026-06-16T12:00:00");

  it("marks done tasks green on their completion date", () => {
    const dots = dayDots(
      [makeTask({ status: "done", completedAt: "2026-06-10T09:00:00.000Z" })],
      today,
    );
    expect(dots["2026-06-10"]).toEqual(["done"]);
  });

  it("marks past-due open tasks as overdue", () => {
    const dots = dayDots([makeTask({ status: "todo", dueDate: "2026-06-10" })], today);
    expect(dots["2026-06-10"]).toEqual(["overdue"]);
  });

  it("marks upcoming in_progress tasks amber", () => {
    const dots = dayDots([makeTask({ status: "in_progress", dueDate: "2026-06-20" })], today);
    expect(dots["2026-06-20"]).toEqual(["in_progress"]);
  });

  it("gives upcoming todos and cancelled tasks no dot", () => {
    const dots = dayDots(
      [
        makeTask({ status: "todo", dueDate: "2026-06-20" }),
        makeTask({ status: "cancelled", dueDate: "2026-06-10" }),
      ],
      today,
    );
    expect(Object.keys(dots)).toHaveLength(0);
  });
});
