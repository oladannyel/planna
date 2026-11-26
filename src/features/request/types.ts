import type { TaskPriority, TaskStatus } from "@/features/tasks/types";

export type RequestState = "pending" | "accepted" | "rejected";

/** A submission through a workspace request link. */
export interface WorkRequest {
  id: string;
  workspaceId: string;
  requesterName: string;
  requesterEmail: string | null;
  title: string;
  description: string;
  urgency: TaskPriority;
  desiredDeadline: string | null;
  state: RequestState;
  decidedAt: string | null;
  declineReason: string | null;
  taskId: string | null;
  token: string;
  createdAt: string;
  updatedAt: string;
}

/** What the public status page shows: the request, plus how its task is doing. */
export interface RequestStatusView {
  title: string;
  description: string;
  requesterName: string;
  urgency: TaskPriority;
  state: RequestState;
  declineReason: string | null;
  createdAt: string;
  decidedAt: string | null;
  ownerName: string | null;
  /** Null until accepted. */
  taskStatus: TaskStatus | null;
  completedAt: string | null;
}
