import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Task } from "@/features/tasks/types";

import { WeeklyPlanner } from "../WeeklyPlanner";
import { bucketByDay, weekDays } from "../week";

function makeTask(id: string, dueDate: string): Task {
  return {
    id,
    workspaceId: "ws-1",
    title: `Task ${id}`,
    description: null,
    status: "todo",
    priority: "medium",
    tags: [],
    dueDate,
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
  };
}

describe("WeeklyPlanner", () => {
  const days = weekDays("2026-06-15");
  const buckets = bucketByDay([makeTask("1", "2026-06-15")], days);

  it("renders all seven weekday headers", () => {
    render(
      <WeeklyPlanner days={days} buckets={buckets} prevWeek="2026-06-08" nextWeek="2026-06-22" />,
    );
    for (const weekday of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      expect(screen.getByText(weekday)).toBeInTheDocument();
    }
  });

  it("places a task in its day bucket", () => {
    render(
      <WeeklyPlanner days={days} buckets={buckets} prevWeek="2026-06-08" nextWeek="2026-06-22" />,
    );
    expect(screen.getByText("Task 1")).toBeInTheDocument();
  });

  it("links to the previous and next weeks", () => {
    render(
      <WeeklyPlanner days={days} buckets={buckets} prevWeek="2026-06-08" nextWeek="2026-06-22" />,
    );
    expect(screen.getByRole("link", { name: "Previous week" })).toHaveAttribute(
      "href",
      "/weekly?week=2026-06-08",
    );
    expect(screen.getByRole("link", { name: "Next week" })).toHaveAttribute(
      "href",
      "/weekly?week=2026-06-22",
    );
  });
});
