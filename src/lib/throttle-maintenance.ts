import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Delete throttle counters for windows that have closed.
 *
 * `request_throttle` gains a row per bucket per hour and nothing in the
 * request path ever removes one, so without this the table grows forever —
 * slowly, invisibly, and in a way that only shows up as a creeping index.
 * Called from the daily health-check cron rather than given a schedule of its
 * own: one job that already runs is cheaper than a second one to forget.
 *
 * Keeps a day of history, which is well past any live window and leaves
 * something to look at when diagnosing a throttle that fired unexpectedly.
 */
export async function pruneRequestThrottle(
  olderThanSeconds = 86_400,
): Promise<Result<{ deleted: number }>> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("prune_request_throttle", {
    p_older_than_seconds: olderThanSeconds,
  });

  if (error) {
    return err({ code: "DB_ERROR", message: error.message, cause: error });
  }

  return ok({ deleted: data ?? 0 });
}
