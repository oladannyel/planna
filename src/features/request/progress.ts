import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

import { publicOrigin } from "./link";
import { REQUEST_COLUMNS, rowToRequest } from "./mappers";
import { notifyRequester } from "./notify";
import { requestOwnerForWorkspace } from "./owner";

/**
 * Tell the requester that the task born from their request has moved.
 *
 * Called from `updateTaskStatus`, which is the single place a task changes
 * status in the app — the board's drag handler and the detail sheet both go
 * through it, so hooking it here covers every path without the board or the
 * sheet knowing that requests exist.
 *
 * Cheap on the common case: most tasks have no request behind them, and the
 * lookup is one indexed read on `requests.task_id` that returns nothing.
 *
 * Best effort by design. A status change must not fail because a mail could
 * not be queued; the owner moved a card and the card moved.
 */
export async function notifyRequesterOfTaskStatus(taskId: string, status: string): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("requests")
      .select(REQUEST_COLUMNS)
      .eq("task_id", taskId)
      .eq("state", "accepted")
      .maybeSingle();

    if (error || !data) return;

    const request = rowToRequest(data);
    if (!request.requesterEmail) return;

    const owner = await requestOwnerForWorkspace(request.workspaceId);
    await notifyRequester(
      { admin, request, owner, origin: await publicOrigin() },
      {
        kind: "progress",
        status,
      },
    );
  } catch (cause) {
    logger.warn("Could not notify requester of a status change", { taskId, status, cause });
  }
}
