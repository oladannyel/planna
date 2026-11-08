import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Task } from "@/features/tasks/types";

const h = vi.hoisted(() => {
  const subscriptions: { channelName: string; filter: string }[] = [];
  return { subscriptions };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: (channelName: string) => {
      const channel = {
        on: (_event: string, config: { filter: string }) => {
          h.subscriptions.push({ channelName, filter: config.filter });
          return channel;
        },
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel: () => Promise.resolve(),
  }),
}));

const { useTasks } = await import("../useTasks");

function makeTask(id: string, workspaceId = "ws-1"): Task {
  return {
    id,
    workspaceId,
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
    createdAt: "2026-11-08T09:00:00.000Z",
    updatedAt: "2026-11-08T09:00:00.000Z",
  };
}

beforeEach(() => {
  h.subscriptions.length = 0;
});

describe("useTasks", () => {
  it("seeds from the server list", () => {
    const { result } = renderHook(() => useTasks([makeTask("a")], "ws-1"));
    expect(result.current.tasks).toHaveLength(1);
  });

  /**
   * The reload bug: a server action revalidates, new props arrive, and the
   * board must follow them rather than keep its first-render snapshot.
   */
  it("adopts a new server list when the props change", () => {
    const { result, rerender } = renderHook(
      ({ tasks }: { tasks: Task[] }) => useTasks(tasks, "ws-1"),
      { initialProps: { tasks: [] as Task[] } },
    );
    expect(result.current.tasks).toHaveLength(0);

    rerender({ tasks: [makeTask("a"), makeTask("b")] });
    expect(result.current.tasks).toHaveLength(2);
    expect(result.current.tasks.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("adopts a server list that removes a task", () => {
    const { result, rerender } = renderHook(
      ({ tasks }: { tasks: Task[] }) => useTasks(tasks, "ws-1"),
      { initialProps: { tasks: [makeTask("a"), makeTask("b")] } },
    );
    rerender({ tasks: [makeTask("a")] });
    expect(result.current.tasks.map((t) => t.id)).toEqual(["a"]);
  });

  it("keeps local optimistic state when the props are unchanged", () => {
    const list = [makeTask("a")];
    const { result, rerender } = renderHook(
      ({ tasks }: { tasks: Task[] }) => useTasks(tasks, "ws-1"),
      { initialProps: { tasks: list } },
    );
    result.current.setTasks([makeTask("a"), makeTask("local")]);
    rerender({ tasks: list });
    expect(result.current.tasks).toHaveLength(2);
  });

  /** The empty-board bug: no rows meant no id, so no subscription opened. */
  it("subscribes on an empty board when given an explicit workspace id", () => {
    renderHook(() => useTasks([], "ws-1"));
    expect(h.subscriptions).toHaveLength(1);
    expect(h.subscriptions[0]?.channelName).toBe("tasks-changes:ws-1");
    expect(h.subscriptions[0]?.filter).toBe("workspace_id=eq.ws-1");
  });

  it("does not subscribe when the workspace is unknown and the board is empty", () => {
    renderHook(() => useTasks([]));
    expect(h.subscriptions).toHaveLength(0);
  });

  it("falls back to the seed data's workspace when no id is passed", () => {
    renderHook(() => useTasks([makeTask("a", "ws-9")]));
    expect(h.subscriptions[0]?.channelName).toBe("tasks-changes:ws-9");
  });
});
