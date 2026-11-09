import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Task } from "@/features/tasks/types";

// Stub the realtime hook so the board renders deterministically without a
// Supabase channel; pass-through state keeps it a plain controlled list.
vi.mock("@/hooks/useTasks", () => ({
  useTasks: (initial: Task[]) => ({ tasks: initial, setTasks: vi.fn() }),
}));

const { KanbanBoard } = await import("../KanbanBoard");

function makeTask(id: string, status: Task["status"]): Task {
  return {
    id,
    workspaceId: "ws-1",
    title: `Task ${id}`,
    description: null,
    status,
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
  };
}

describe("KanbanBoard", () => {
  it("renders the four status columns", () => {
    render(<KanbanBoard initialTasks={[]} />);
    for (const label of ["To do", "In progress", "Done", "Cancelled"]) {
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    }
  });

  it("places each task in its status column and counts them", () => {
    const tasks = [makeTask("1", "todo"), makeTask("2", "todo"), makeTask("3", "done")];
    render(<KanbanBoard initialTasks={tasks} />);
    expect(screen.getByText("Task 1")).toBeInTheDocument();
    expect(screen.getByText("Task 3")).toBeInTheDocument();
    // Counts now appear in both the toolbar tabs and the column headers, so
    // assert against the column's accessible name rather than a bare "2".
    expect(screen.getByRole("region", { name: "To do, 2 tasks" })).toBeInTheDocument();
    // Singular, not "1 tasks" — this label is read aloud.
    expect(screen.getByRole("region", { name: "Done, 1 task" })).toBeInTheDocument();
  });

  it("filters to a single column when a toolbar tab is chosen", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const tasks = [makeTask("1", "todo"), makeTask("2", "done")];
    render(<KanbanBoard initialTasks={tasks} />);

    await user.click(screen.getByRole("tab", { name: /Done/ }));

    expect(screen.getByText("Task 2")).toBeInTheDocument();
    expect(screen.queryByText("Task 1")).not.toBeInTheDocument();
  });

  it("counts every status in the toolbar", () => {
    const tasks = [makeTask("1", "todo"), makeTask("2", "todo"), makeTask("3", "done")];
    render(<KanbanBoard initialTasks={tasks} />);
    expect(screen.getByRole("tab", { name: /All tasks, 3 tasks/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /To do, 2 tasks/ })).toBeInTheDocument();
  });

  it("shows an empty hint for columns with no tasks", () => {
    render(<KanbanBoard initialTasks={[]} />);
    expect(screen.getAllByText("No tasks")).toHaveLength(4);
  });

  it("caps the Done column and links to its own archive once it exceeds the preview limit", () => {
    const doneTasks = Array.from({ length: 10 }, (_, i) => makeTask(`d${i}`, "done"));
    render(<KanbanBoard initialTasks={doneTasks} />);

    // Count reflects the true total...
    expect(screen.getByRole("region", { name: "Done, 10 tasks" })).toBeInTheDocument();
    // ...but only the preview limit of cards is actually rendered.
    expect(screen.getAllByText(/^Task d/)).toHaveLength(8);
    expect(screen.getByRole("link", { name: "View all 10 →" })).toHaveAttribute(
      "href",
      "/board/archive/done",
    );
  });

  it("caps the Cancelled column and links to its own archive once it exceeds the preview limit", () => {
    const cancelledTasks = Array.from({ length: 23 }, (_, i) => makeTask(`c${i}`, "cancelled"));
    render(<KanbanBoard initialTasks={cancelledTasks} />);

    expect(screen.getByRole("region", { name: "Cancelled, 23 tasks" })).toBeInTheDocument();
    expect(screen.getAllByText(/^Task c/)).toHaveLength(8);
    expect(screen.getByRole("link", { name: "View all 23 →" })).toHaveAttribute(
      "href",
      "/board/archive/cancelled",
    );
  });

  it("caps To do and In progress too once they exceed the preview limit", () => {
    const todoTasks = Array.from({ length: 9 }, (_, i) => makeTask(`t${i}`, "todo"));
    render(<KanbanBoard initialTasks={todoTasks} />);

    expect(screen.getByRole("region", { name: "To do, 9 tasks" })).toBeInTheDocument();
    expect(screen.getAllByText(/^Task t/)).toHaveLength(8);
    expect(screen.getByRole("link", { name: "View all 9 →" })).toHaveAttribute(
      "href",
      "/board/archive/todo",
    );
  });

  it("does not show an archive link when a column is within the preview limit", () => {
    const doneTasks = Array.from({ length: 3 }, (_, i) => makeTask(`d${i}`, "done"));
    render(<KanbanBoard initialTasks={doneTasks} />);
    expect(screen.queryByRole("link", { name: /View all/ })).not.toBeInTheDocument();
  });
});
