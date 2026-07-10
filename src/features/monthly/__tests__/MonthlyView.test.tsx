import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { InsightStats } from "@/features/analytics/metrics";
import type { Task } from "@/features/tasks/types";

import { MonthlyCalendar } from "../MonthlyCalendar";
import { MonthlyStats } from "../MonthlyStats";
import { monthGrid } from "../calendar";

const stats: InsightStats = {
  totalCreated: 12,
  totalCompleted: 7,
  totalCarried: 2,
  completionRate: 58,
  carryoverRate: 16,
  avgCycleTimeHours: 9,
  onTimeRate: 71,
  scheduledRate: 50,
  topTags: [],
};

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    workspaceId: "ws-1",
    title: "Plan the launch",
    description: null,
    status: "todo",
    priority: "medium",
    tags: [],
    dueDate: "2026-06-10",
    dueAt: null,
    estimatedMinutes: null,
    source: "manual",
    requestedBy: null,
    carriedOver: false,
    carryCount: 0,
    statusHistory: [],
    completedAt: null,
    createdAt: "2026-06-01T09:00:00.000Z",
    updatedAt: "2026-06-01T09:00:00.000Z",
    ...overrides,
  };
}

describe("MonthlyStats", () => {
  it("renders the five stat cards", () => {
    render(<MonthlyStats stats={stats} bestStreak={4} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("58%")).toBeInTheDocument();
    expect(screen.getByText("16%")).toBeInTheDocument();
    expect(screen.getByText("71%")).toBeInTheDocument();
    expect(screen.getByText("4d")).toBeInTheDocument();
  });
});

describe("MonthlyCalendar", () => {
  const weeks = monthGrid({ year: 2026, month: 6 });

  it("renders weekday headers and day cells", () => {
    render(<MonthlyCalendar weeks={weeks} dots={{}} tasks={[]} />);
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2026-06-01" })).toBeInTheDocument();
  });

  it("opens a day panel listing that day's tasks on click", async () => {
    const user = userEvent.setup();
    render(
      <MonthlyCalendar weeks={weeks} dots={{}} tasks={[makeTask({ dueDate: "2026-06-10" })]} />,
    );

    await user.click(screen.getByRole("button", { name: "2026-06-10" }));
    expect(screen.getByText("Plan the launch")).toBeInTheDocument();
  });

  it("shows an empty message for a day with no tasks", async () => {
    const user = userEvent.setup();
    render(<MonthlyCalendar weeks={weeks} dots={{}} tasks={[]} />);

    await user.click(screen.getByRole("button", { name: "2026-06-15" }));
    expect(screen.getByText("No tasks on this day.")).toBeInTheDocument();
  });
});
