import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

import { rowToTask } from "../mappers";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

function makeRow(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: "task-1",
    workspace_id: "ws-1",
    title: "Write tests",
    description: "Cover the mapper",
    status: "todo",
    priority: "high",
    tags: ["eng", "quality"],
    due_date: "2026-06-20",
    estimated_minutes: 45,
    source: "manual",
    requested_by: null,
    carried_over: false,
    carry_count: 0,
    status_history: [{ status: "todo", changedAt: "2026-06-16T10:00:00.000Z" }],
    completed_at: null,
    created_at: "2026-06-16T09:00:00.000Z",
    updated_at: "2026-06-16T09:30:00.000Z",
    ...overrides,
  };
}

describe("rowToTask", () => {
  it("maps a full row to camelCase domain shape", () => {
    const task = rowToTask(makeRow());
    expect(task).toEqual({
      id: "task-1",
      workspaceId: "ws-1",
      title: "Write tests",
      description: "Cover the mapper",
      status: "todo",
      priority: "high",
      tags: ["eng", "quality"],
      dueDate: "2026-06-20",
      estimatedMinutes: 45,
      source: "manual",
      requestedBy: null,
      carriedOver: false,
      carryCount: 0,
      statusHistory: [{ status: "todo", changedAt: "2026-06-16T10:00:00.000Z" }],
      completedAt: null,
      createdAt: "2026-06-16T09:00:00.000Z",
      updatedAt: "2026-06-16T09:30:00.000Z",
    });
  });

  it("preserves nullable fields", () => {
    const task = rowToTask(
      makeRow({ description: null, due_date: null, estimated_minutes: null, requested_by: null }),
    );
    expect(task.description).toBeNull();
    expect(task.dueDate).toBeNull();
    expect(task.estimatedMinutes).toBeNull();
    expect(task.requestedBy).toBeNull();
  });

  it("falls back to an empty history for malformed status_history", () => {
    expect(rowToTask(makeRow({ status_history: "not-an-array" })).statusHistory).toEqual([]);
    expect(rowToTask(makeRow({ status_history: null })).statusHistory).toEqual([]);
    expect(
      rowToTask(makeRow({ status_history: [{ status: "bogus", changedAt: 1 }] })).statusHistory,
    ).toEqual([]);
  });

  it("maps request-link provenance", () => {
    const task = rowToTask(makeRow({ source: "request_link", requested_by: "Ada" }));
    expect(task.source).toBe("request_link");
    expect(task.requestedBy).toBe("Ada");
  });
});
