import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TaskCard } from "../TaskCard";
import type { Task } from "../types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t",
    workspaceId: "ws-1",
    title: "Ship the thing",
    description: null,
    status: "todo",
    priority: "high",
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

describe("TaskCard", () => {
  it("renders the title, priority, and status", () => {
    render(<TaskCard task={makeTask()} />);
    expect(screen.getByText("Ship the thing")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("To do")).toBeInTheDocument();
  });

  it("shows a carryover badge with the count", () => {
    render(<TaskCard task={makeTask({ carriedOver: true, carryCount: 3 })} />);
    expect(screen.getByText("Carried ×3")).toBeInTheDocument();
  });

  it("omits the carryover badge for fresh tasks", () => {
    render(<TaskCard task={makeTask()} />);
    expect(screen.queryByText(/Carried/)).not.toBeInTheDocument();
  });

  it("shows the requester for request-link tasks", () => {
    render(<TaskCard task={makeTask({ source: "request_link", requestedBy: "Ada" })} />);
    expect(screen.getByText("Requested by Ada")).toBeInTheDocument();
  });

  it("renders description and due date when present", () => {
    render(<TaskCard task={makeTask({ description: "Do it well", dueDate: "2026-07-01" })} />);
    expect(screen.getByText("Do it well")).toBeInTheDocument();
    expect(screen.getByText("2026-07-01")).toBeInTheDocument();
  });

  it("applies the priority-coloured left border", () => {
    const { container } = render(<TaskCard task={makeTask({ priority: "urgent" })} />);
    expect(container.firstElementChild?.className).toContain("border-l-danger");
  });
});
