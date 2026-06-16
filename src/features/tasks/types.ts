export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskSource = "manual" | "ai_parsed" | "request_link";

export interface StatusHistoryEntry {
  status: TaskStatus;
  changedAt: string; // ISO timestamp
}

export interface Task {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  dueDate: string | null; // ISO date string "YYYY-MM-DD"
  estimatedMinutes: number | null;
  source: TaskSource;
  requestedBy: string | null;
  carriedOver: boolean;
  carryCount: number;
  statusHistory: StatusHistoryEntry[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  description?: string;
  priority: TaskPriority;
  tags: string[];
  dueDate?: string;
  estimatedMinutes?: number;
}

export interface ParsedTaskResult {
  title: string;
  priority: TaskPriority;
  tags: string[];
  dueDate: string | null;
  estimatedMinutes: number | null;
  confidence: number; // 0–1, for UI feedback
}
