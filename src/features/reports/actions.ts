"use server";

import { addDays, endOfDay, format, parseISO } from "date-fns";
import { revalidatePath } from "next/cache";

import type { InsightStats } from "@/features/analytics/metrics";
import { monthlyStats } from "@/features/analytics/metrics";
import { generateMonthlySummary } from "@/features/monthly/actions";
import type { MonthlySummaryResult } from "@/features/monthly/actions";
import { rowToTask } from "@/features/tasks/mappers";
import { getAuthedContext } from "@/features/workspace/queries";
import { env } from "@/lib/env";
import { getOpenRouter } from "@/lib/openrouter";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import type { Json } from "@/types/database";

export interface WeeklyReportResult {
  narrative: string;
  stats: InsightStats;
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
    topTags: stats.topTags.map((tag) => ({ tag: tag.tag, count: tag.count })),
  };
}

function buildPrompt(weekStart: string, stats: InsightStats): string {
  const label = format(parseISO(weekStart), "MMM d, yyyy");
  const focus = stats.topTags.map((tag) => tag.tag).join(", ") || "none tagged";
  return `You are a productivity coach. Write a concise 2-paragraph weekly review for the week of ${label}.

Data:
- Tasks created: ${stats.totalCreated}
- Completed: ${stats.totalCompleted} (${stats.completionRate}% completion rate)
- Carried over: ${stats.totalCarried}
- On-time completion rate: ${stats.onTimeRate}%
- Top focus areas: ${focus}

Paragraph 1: What got done and where focus went.
Paragraph 2: One concrete adjustment for next week.

Write in second person ("you"), be specific, no platitudes.`;
}

/** Generate (or regenerate) the weekly report and persist it. Skips empty weeks. */
export async function generateWeeklyReport(weekStart: string): Promise<Result<WeeklyReportResult>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const start = parseISO(weekStart);
  const { data, error } = await ctx.value.supabase
    .from("tasks")
    .select("*")
    .eq("workspace_id", ctx.value.workspaceId)
    .gte("created_at", start.toISOString())
    .lte("created_at", endOfDay(addDays(start, 6)).toISOString());

  if (error) {
    return err({ code: "DB_ERROR", message: error.message, cause: error });
  }

  const tasks = data.map(rowToTask);
  if (tasks.length === 0) {
    return err({ code: "VALIDATION_ERROR", message: "No tasks to report for this week" });
  }

  const stats = monthlyStats(tasks);

  let narrative = "Report unavailable.";
  try {
    const response = await getOpenRouter().chat.completions.create({
      model: env.OPENROUTER_REPORT_MODEL,
      max_tokens: 400,
      temperature: 0.4,
      messages: [{ role: "user", content: buildPrompt(weekStart, stats) }],
    });
    narrative = response.choices[0]?.message?.content ?? narrative;
  } catch (cause) {
    return err({ code: "AI_ERROR", message: "Weekly report generation failed", cause });
  }

  const { error: upsertError } = await ctx.value.supabase
    .from("weekly_reports")
    .upsert(
      {
        workspace_id: ctx.value.workspaceId,
        week_start: weekStart,
        narrative,
        stats: statsToJson(stats),
      },
      { onConflict: "workspace_id,week_start" },
    );

  if (upsertError) {
    return err({ code: "DB_ERROR", message: upsertError.message, cause: upsertError });
  }

  revalidatePath("/reports");
  return ok({ narrative, stats });
}

/** The monthly report reuses the monthly summary generation. */
export async function generateMonthlyReport(
  year: number,
  month: number,
): Promise<Result<MonthlySummaryResult>> {
  return generateMonthlySummary(year, month);
}

/**
 * Yearly summary — not yet implemented (spec §10 stub). Must stay `async`
 * because "use server" requires all exports to be async functions.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function generateYearlySummary(year: number): Promise<Result<never>> {
  return err({
    code: "NOT_FOUND",
    message: `Yearly summary for ${String(year)} not yet implemented`,
  });
}
