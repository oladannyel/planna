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

  it("orders carryovers before fresh tasks", () => {
    const fresh = makeTask("fresh");
    const carried = makeTask("carried", { carriedOver: true });
    render(<DailyView tasks={[fresh, carried]} carryoverCount={1} streak={2} />);

    const items = screen.getAllByRole("listitem");
    expect(items[0]?.textContent).toContain("Task carried");
    expect(screen.getByText(/1 task has carried over/)).toBeInTheDocument();
    expect(screen.getByText("2 days streak")).toBeInTheDocument();
  });
});
