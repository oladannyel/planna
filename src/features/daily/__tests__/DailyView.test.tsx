import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Task } from "@/features/tasks/types";

import { CarryoverBanner } from "../CarryoverBanner";
import { DailyView } from "../DailyView";
import { StreakCounter } from "../StreakCounter";

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    workspaceId: "ws-1",
    title: `Task ${id}`,
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

describe("CarryoverBanner", () => {
  it("renders nothing when there are no carryovers", () => {
    const { container } = render(<CarryoverBanner count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uses singular wording for one carryover", () => {
    render(<CarryoverBanner count={1} />);
    expect(screen.getByText(/1 task has carried over/)).toBeInTheDocument();
  });

  it("uses plural wording for many", () => {
    render(<CarryoverBanner count={3} />);
    expect(screen.getByText(/3 tasks have carried over/)).toBeInTheDocument();
  });
});

describe("StreakCounter", () => {
  it("renders a singular day", () => {
    render(<StreakCounter streak={1} />);
    expect(screen.getByText("1 day streak")).toBeInTheDocument();
  });

  it("renders plural days", () => {
    render(<StreakCounter streak={0} />);
    expect(screen.getByText("0 days streak")).toBeInTheDocument();
  });
});

describe("DailyView", () => {
  it("shows the empty state with no tasks", () => {
    render(<DailyView tasks={[]} carryoverCount={0} streak={0} />);
    expect(screen.getByText("Nothing scheduled")).toBeInTheDocument();
  });

  const TODAY = new Date(2026, 5, 16, 12);

  it("groups tasks by the day they were created, oldest section first", () => {
    const tasks = [
      makeTask("fresh", { createdAt: new Date(2026, 5, 16, 9).toISOString() }),
      makeTask("yesterday", { createdAt: new Date(2026, 5, 15, 9).toISOString() }),
      makeTask("ancient", { createdAt: new Date(2026, 5, 2, 9).toISOString() }),
    ];
    render(<DailyView tasks={tasks} carryoverCount={2} streak={2} today={TODAY} />);

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      "Carried over from earlier",
      "Carried over from yesterday",
      "Created today",
    ]);

    const items = screen.getAllByRole("listitem");
    expect(items[0]?.textContent).toContain("Task ancient");
    expect(items[2]?.textContent).toContain("Task fresh");
    expect(screen.getByText(/2 tasks have carried over/)).toBeInTheDocument();
    expect(screen.getByText("2 days streak")).toBeInTheDocument();
  });

  it("renders only the sections that have tasks", () => {
    const tasks = [makeTask("fresh", { createdAt: new Date(2026, 5, 16, 9).toISOString() })];
    render(<DailyView tasks={tasks} carryoverCount={0} streak={0} today={TODAY} />);

    expect(screen.getByRole("heading", { level: 2, name: "Created today" })).toBeVisible();
    expect(screen.queryByText("Carried over from yesterday")).not.toBeInTheDocument();
  });

  it("still orders carryovers before fresh tasks within a section", () => {
    const created = new Date(2026, 5, 15, 9).toISOString();
    const fresh = makeTask("fresh", { createdAt: created });
    const carried = makeTask("carried", { createdAt: created, carriedOver: true });
    render(<DailyView tasks={[fresh, carried]} carryoverCount={1} streak={2} today={TODAY} />);

    const items = screen.getAllByRole("listitem");
    expect(items[0]?.textContent).toContain("Task carried");
  });
});
