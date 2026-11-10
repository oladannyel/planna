"use server";

import { endOfMonth, format, startOfMonth } from "date-fns";
import { revalidatePath } from "next/cache";

import type { InsightStats } from "@/features/analytics/metrics";
import { monthlyStats } from "@/features/analytics/metrics";
import { TASK_COLUMNS } from "@/features/tasks/columns";
import { rowToTask } from "@/features/tasks/mappers";
import { getAuthedContext } from "@/features/workspace/queries";
import { createCompletion } from "@/lib/ai-completion";
import { classifyProviderError } from "@/lib/ai-errors";
import { env } from "@/lib/env";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import type { Json } from "@/types/database";

export interface MonthlySummaryResult {
  narrative: string;
  stats: InsightStats;
}

function topTagsToJson(stats: InsightStats): Json {
  return stats.topTags.map((tag) => ({ tag: tag.tag, count: tag.count }));
}

function statsToJson(stats: InsightStats): Json {
  return {
    totalCreated: stats.totalCreated,
    totalCompleted: stats.totalCompleted,
    totalCarried: stats.totalCarried,
    completionRate: stats.completionRate,
    carryoverRate: stats.carryoverRate,
    avgCycleTimeHours: stats.avgCycleTimeHours,
    onTimeRate: stats.onTimeRate,
    topTags: topTagsToJson(stats),
  };
}

function buildPrompt(year: number, month: number, stats: InsightStats): string {
  const label = format(new Date(year, month - 1, 1), "MMMM yyyy");
  const focus = stats.topTags.map((tag) => tag.tag).join(", ") || "none tagged";
  return `You are a productivity coach. Write a concise 3-paragraph monthly performance summary for ${label}.

Data:
- Tasks created: ${stats.totalCreated}
- Completed: ${stats.totalCompleted} (${stats.completionRate}% completion rate)
- Carried over without completion: ${stats.totalCarried}
- On-time completion rate: ${stats.onTimeRate}%
- Top focus areas: ${focus}

Paragraph 1: What was accomplished this month.
Paragraph 2: Where momentum broke down or tasks got stuck.
Paragraph 3: One concrete behavioural recommendation for next month.

Write in second person ("you"), be specific, no generic platitudes.`;
}

/**
 * Generate (or regenerate) the AI monthly summary and persist it. Returns a
 * VALIDATION_ERROR for an empty month so the caller skips AI + storage entirely.
 */
export async function generateMonthlySummary(
  year: number,
  month: number,
): Promise<Result<MonthlySummaryResult>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const first = new Date(year, month - 1, 1);
  const { data, error } = await ctx.value.supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("workspace_id", ctx.value.workspaceId)
    .gte("created_at", startOfMonth(first).toISOString())
    .lte("created_at", endOfMonth(first).toISOString());

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  const tasks = data.map(rowToTask);
  if (tasks.length === 0) {
    return err({ code: "VALIDATION_ERROR", message: "No tasks to summarize this month" });
  }

  const stats = monthlyStats(tasks);

  let narrative = "Summary unavailable.";
  try {
    const response = await createCompletion(
      {
        model: env.AI_REPORT_MODEL,
        max_tokens: 1500,
        temperature: 0.4,
        messages: [{ role: "user", content: buildPrompt(year, month, stats) }],
      },
      // A reasoning model can spend its whole budget on the scratchpad and
      // return 200 with no content. Saving that as the narrative would write
      // the placeholder into the database as though it were the report.
      { accept: (content) => content.trim().length > 0 },
    );
    narrative = response.choices[0]?.message?.content ?? narrative;
  } catch (cause) {
    const classified = classifyProviderError(cause);
    if (classified) return err(classified);
    return err({ code: "AI_ERROR", message: "Monthly summary generation failed", cause });
  }

  const { error: upsertError } = await ctx.value.supabase.from("monthly_summaries").upsert(
    {
      workspace_id: ctx.value.workspaceId,
      year,
      month,
      narrative,
      stats: statsToJson(stats),
      top_categories: topTagsToJson(stats),
    },
    { onConflict: "workspace_id,year,month" },
  );

  if (upsertError) {
    return err({ code: "DB_ERROR", message: upsertError.message });
  }

  revalidatePath("/monthly");
  revalidatePath("/reports");
  return ok({ narrative, stats });
}
