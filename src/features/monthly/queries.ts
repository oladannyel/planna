import { getAuthedContext } from "@/features/workspace/queries";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";

export interface StoredMonthlySummary {
  narrative: string;
  createdAt: string;
}

/** Fetch the persisted monthly summary, or `null` if none exists yet. */
export async function getMonthlySummary(
  year: number,
  month: number,
): Promise<Result<StoredMonthlySummary | null>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.value.supabase
    .from("monthly_summaries")
    .select("narrative, created_at")
    .eq("workspace_id", ctx.value.workspaceId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  return ok(data ? { narrative: data.narrative, createdAt: data.created_at } : null);
}
