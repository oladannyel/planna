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
  it("renders the title", () => {
    render(<TaskCard task={makeTask()} />);
    expect(screen.getByText("Ship the thing")).toBeInTheDocument();
  });

  it("conveys priority to screen readers, since it is shown only as a colour", () => {
    render(<TaskCard task={makeTask({ priority: "urgent" })} />);
    expect(screen.getByText("Urgent")).toBeInTheDocument();
  });

  it("shows the carryover count", () => {
    render(<TaskCard task={makeTask({ carriedOver: true, carryCount: 3 })} />);
    expect(screen.getByTitle("Carried over 3 time(s)")).toHaveTextContent("3");
  });

  it("renders up to three tags, then a overflow count", () => {
    render(<TaskCard task={makeTask({ tags: ["a", "b", "c", "d", "e"] })} />);
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("c")).toBeInTheDocument();
    expect(screen.queryByText("d")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("omits the carryover badge for fresh tasks", () => {
    render(<TaskCard task={makeTask()} />);
    expect(screen.queryByTitle(/Carried over/)).not.toBeInTheDocument();
  });

  it("shows the requester for request-link tasks", () => {
    render(<TaskCard task={makeTask({ source: "request_link", requestedBy: "Ada" })} />);
    expect(screen.getByText("from Ada")).toBeInTheDocument();
  });

  it("renders description and due date when present", () => {
    render(<TaskCard task={makeTask({ description: "Do it well", dueDate: "2026-07-01" })} />);
    expect(screen.getByText("Do it well")).toBeInTheDocument();
    expect(screen.getByText("2026-07-01")).toBeInTheDocument();
  });

  it("applies the priority-coloured left edge", () => {
    const { container } = render(<TaskCard task={makeTask({ priority: "urgent" })} />);
    expect(container.firstElementChild?.className).toContain("before:bg-danger");
  });
});
