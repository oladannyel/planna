import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Task } from "../types";

const h = vi.hoisted(() => ({
  updateTask: vi.fn(),
  updateTaskStatus: vi.fn(),
  deleteTask: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../actions", () => ({
  updateTask: h.updateTask,
  updateTaskStatus: h.updateTaskStatus,
  deleteTask: h.deleteTask,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: h.refresh }),
}));

const { TaskDetailSheet } = await import("../TaskDetailSheet");

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    workspaceId: "ws-1",
    title: "Ship the thing",
    description: null,
    status: "todo",
    priority: "medium",
    tags: ["eng"],
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

beforeEach(() => {
  h.updateTask.mockReset();
  h.updateTaskStatus.mockReset();
  h.deleteTask.mockReset();
  h.refresh.mockReset();
});

describe("TaskDetailSheet", () => {
  it("saves edited fields via updateTask then refreshes and closes", async () => {
    h.updateTask.mockResolvedValue({ ok: true, value: makeTask() });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<TaskDetailSheet task={makeTask()} onClose={onClose} />);

    const title = screen.getByDisplayValue("Ship the thing");
    await user.clear(title);
    await user.type(title, "Ship it now");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.updateTask).toHaveBeenCalledTimes(1));
    expect(h.updateTask.mock.calls[0]?.[0]).toBe("task-1");
    expect(h.updateTask.mock.calls[0]?.[1]).toMatchObject({ title: "Ship it now" });
    expect(h.refresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("routes a status change through updateTaskStatus", async () => {
    h.updateTask.mockResolvedValue({ ok: true, value: makeTask() });
    h.updateTaskStatus.mockResolvedValue({ ok: true, value: makeTask({ status: "done" }) });
    const user = userEvent.setup();
    render(<TaskDetailSheet task={makeTask()} onClose={vi.fn()} />);

    await user.selectOptions(screen.getByDisplayValue("To do"), "done");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.updateTaskStatus).toHaveBeenCalledWith("task-1", "done"));
  });

  it("blocks saving an empty title", async () => {
    const user = userEvent.setup();
    render(<TaskDetailSheet task={makeTask()} onClose={vi.fn()} />);
    await user.clear(screen.getByDisplayValue("Ship the thing"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Title can't be empty/)).toBeInTheDocument();
    expect(h.updateTask).not.toHaveBeenCalled();
  });

  it("deletes via deleteTask", async () => {
    h.deleteTask.mockResolvedValue({ ok: true, value: { id: "task-1" } });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<TaskDetailSheet task={makeTask()} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(h.deleteTask).toHaveBeenCalledWith("task-1"));
    expect(onClose).toHaveBeenCalled();
  });
});
