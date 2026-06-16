import type { DragEndEvent } from "@dnd-kit/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Task } from "@/features/tasks/types";

const h = vi.hoisted(() => ({ updateTaskStatus: vi.fn() }));

vi.mock("@/features/tasks/actions", () => ({
  updateTaskStatus: h.updateTaskStatus,
}));

const { resolveDrop, moveTask, commitDrop } = await import("../dnd");

function event(activeId: string, overId: string | null): DragEndEvent {
  return {
    active: { id: activeId },
    over: overId === null ? null : { id: overId },
  } as unknown as DragEndEvent;
}

function makeTask(id: string, status: Task["status"]): Task {
  return {
    id,
    workspaceId: "ws-1",
    title: id,
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

beforeEach(() => {
  h.updateTaskStatus.mockReset();
  h.updateTaskStatus.mockResolvedValue({ ok: true, value: {} });
});

describe("resolveDrop", () => {
  it("returns null without a drop target", () => {
    expect(resolveDrop(event("t1", null))).toBeNull();
  });

  it("returns null for an unknown column id", () => {
    expect(resolveDrop(event("t1", "not-a-status"))).toBeNull();
  });

  it("resolves a valid task→column drop", () => {
    expect(resolveDrop(event("t1", "done"))).toEqual({ taskId: "t1", status: "done" });
  });
});

describe("moveTask", () => {
  it("changes only the matching task's status", () => {
    const tasks = [makeTask("a", "todo"), makeTask("b", "todo")];
    const next = moveTask(tasks, "a", "done");
    expect(next.find((t) => t.id === "a")?.status).toBe("done");
    expect(next.find((t) => t.id === "b")?.status).toBe("todo");
  });
});

describe("commitDrop", () => {
  it("no-ops on an invalid drop", async () => {
    const setTasks = vi.fn();
    await commitDrop(event("t1", null), [makeTask("t1", "todo")], setTasks);
    expect(setTasks).not.toHaveBeenCalled();
    expect(h.updateTaskStatus).not.toHaveBeenCalled();
  });

  it("no-ops when the status is unchanged", async () => {
    const setTasks = vi.fn();
    await commitDrop(event("t1", "todo"), [makeTask("t1", "todo")], setTasks);
    expect(setTasks).not.toHaveBeenCalled();
    expect(h.updateTaskStatus).not.toHaveBeenCalled();
  });

  it("optimistically moves and persists on success", async () => {
    const setTasks = vi.fn();
    const tasks = [makeTask("t1", "todo")];
    await commitDrop(event("t1", "done"), tasks, setTasks);
    expect(setTasks).toHaveBeenCalledTimes(1);
    expect(h.updateTaskStatus).toHaveBeenCalledWith("t1", "done");
    const moved = setTasks.mock.calls[0]?.[0] as Task[];
    expect(moved[0]?.status).toBe("done");
  });

  it("rolls back when the server rejects the move", async () => {
    h.updateTaskStatus.mockResolvedValue({ ok: false, error: { code: "DB_ERROR", message: "x" } });
    const setTasks = vi.fn();
    const tasks = [makeTask("t1", "todo")];
    await commitDrop(event("t1", "done"), tasks, setTasks);
    expect(setTasks).toHaveBeenCalledTimes(2);
    expect(setTasks.mock.calls[1]?.[0]).toBe(tasks); // restored snapshot
  });

  it("no-ops when the dragged task is unknown", async () => {
    const setTasks = vi.fn();
    await commitDrop(event("ghost", "done"), [makeTask("t1", "todo")], setTasks);
    expect(setTasks).not.toHaveBeenCalled();
  });
});
