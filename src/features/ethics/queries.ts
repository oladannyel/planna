import { getAuthedContext } from "@/features/workspace/queries";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";

import { parseAnswers, rowToQuestion } from "./mappers";
import type { EthicsQuestion, Reflection } from "./types";

async function listQuestions(activeOnly: boolean): Promise<Result<EthicsQuestion[]>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  let query = ctx.value.supabase
    .from("ethics_questions")
    .select("*")
    .eq("workspace_id", ctx.value.workspaceId);
  if (activeOnly) query = query.eq("active", true);

  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }
  return ok(data.map(rowToQuestion));
}

export function getActiveQuestions(): Promise<Result<EthicsQuestion[]>> {
  return listQuestions(true);
}

export function getAllQuestions(): Promise<Result<EthicsQuestion[]>> {
  return listQuestions(false);
}

/** The stored reflection for a week, or `null` if none. */
export async function getReflection(weekStart: string): Promise<Result<Reflection | null>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.value.supabase
    .from("weekly_reports")
    .select("week_start, ethics_answers")
    .eq("workspace_id", ctx.value.workspaceId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }
  if (!data || data.ethics_answers === null) return ok(null);

  return ok({ weekStart: data.week_start, answers: parseAnswers(data.ethics_answers) });
}

/** Recent weeks that have a reflection, newest first. */
export async function getReflectionHistory(limit = 8): Promise<Result<Reflection[]>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.value.supabase
    .from("weekly_reports")
    .select("week_start, ethics_answers")
    .eq("workspace_id", ctx.value.workspaceId)
    .not("ethics_answers", "is", null)
    .order("week_start", { ascending: false })
    .limit(limit);

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  return ok(
    data.map((row) => ({ weekStart: row.week_start, answers: parseAnswers(row.ethics_answers) })),
  );
}
