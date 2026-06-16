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
    // Two tasks in "To do" → count badge shows 2.
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows an empty hint for columns with no tasks", () => {
    render(<KanbanBoard initialTasks={[]} />);
    expect(screen.getAllByText("No tasks")).toHaveLength(4);
  });
});
