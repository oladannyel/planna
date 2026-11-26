import type { Database } from "@/types/database";

import type { WorkRequest } from "./types";

type RequestRow = Database["public"]["Tables"]["requests"]["Row"];

/** The columns every read of a request names. No `select *` (standards §4). */
export const REQUEST_COLUMNS =
  "id, workspace_id, requester_name, requester_email, title, description, urgency, desired_deadline, state, decided_at, decline_reason, task_id, token, created_at, updated_at";

export function rowToRequest(row: RequestRow): WorkRequest {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    title: row.title,
    description: row.description,
    urgency: row.urgency,
    desiredDeadline: row.desired_deadline,
    state: row.state,
    decidedAt: row.decided_at,
    declineReason: row.decline_reason,
    taskId: row.task_id,
    token: row.token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
