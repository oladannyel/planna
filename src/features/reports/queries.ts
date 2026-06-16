import { getMonthlySummary } from "@/features/monthly/queries";
import { getAuthedContext } from "@/features/workspace/queries";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";

export interface StoredWeeklyReport {
  narrative: string | null;
  createdAt: string;
}

/** Fetch the persisted weekly report, or `null` if none exists yet. */
export async function getWeeklyReport(
  weekStart: string,
): Promise<Result<StoredWeeklyReport | null>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.value.supabase
    .from("weekly_reports")
    .select("narrative, created_at")
    .eq("workspace_id", ctx.value.workspaceId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message, cause: error });
  }

  return ok(data ? { narrative: data.narrative, createdAt: data.created_at } : null);
}

/** The monthly report reads the monthly summary store. */
export const getMonthlyReport = getMonthlySummary;
