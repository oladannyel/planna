"use server";

import { revalidatePath } from "next/cache";

import { getAuthedContext } from "@/features/workspace/queries";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import type { Json } from "@/types/database";

import { rowToQuestion } from "./mappers";
import { ethicsQuestionSchema, reflectionSchema } from "./schema";
import type { EthicsQuestion, Reflection, ReflectionAnswer } from "./types";

function answersToJson(answers: ReflectionAnswer[]): Json {
  return answers.map((a) => ({ questionId: a.questionId, question: a.question, answer: a.answer }));
}

export async function addQuestion(question: string): Promise<Result<EthicsQuestion>> {
  const validated = ethicsQuestionSchema.safeParse({ question });
  if (!validated.success) {
    return err({
      code: "VALIDATION_ERROR",
      message: "Invalid question",
      fields: validated.error.flatten().fieldErrors,
    });
  }

  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.value.supabase
    .from("ethics_questions")
    .insert({ workspace_id: ctx.value.workspaceId, question: validated.data.question })
    .select("id, workspace_id, question, sort_order, active, created_at")
    .single();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  revalidatePath("/ethics");
  return ok(rowToQuestion(data));
}

export async function updateQuestion(
  id: string,
  question: string,
): Promise<Result<EthicsQuestion>> {
  const validated = ethicsQuestionSchema.safeParse({ question });
  if (!validated.success) {
    return err({
      code: "VALIDATION_ERROR",
      message: "Invalid question",
      fields: validated.error.flatten().fieldErrors,
    });
  }

  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.value.supabase
    .from("ethics_questions")
    .update({ question: validated.data.question })
    .eq("workspace_id", ctx.value.workspaceId)
    .eq("id", id)
    .select("id, workspace_id, question, sort_order, active, created_at")
    .single();

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  revalidatePath("/ethics");
  return ok(rowToQuestion(data));
}

export async function deactivateQuestion(id: string): Promise<Result<{ id: string }>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { error } = await ctx.value.supabase
    .from("ethics_questions")
    .update({ active: false })
    .eq("workspace_id", ctx.value.workspaceId)
    .eq("id", id);

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  revalidatePath("/ethics");
  return ok({ id });
}

export async function reorderQuestions(orderedIds: string[]): Promise<Result<{ count: number }>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  for (const [index, id] of orderedIds.entries()) {
    const { error } = await ctx.value.supabase
      .from("ethics_questions")
      .update({ sort_order: index })
      .eq("workspace_id", ctx.value.workspaceId)
      .eq("id", id);
    if (error) {
      return err({ code: "DB_ERROR", message: error.message });
    }
  }

  revalidatePath("/ethics");
  return ok({ count: orderedIds.length });
}

/** Save (upsert) the week's reflection answers into weekly_reports.ethics_answers. */
export async function saveReflection(
  weekStart: string,
  answers: ReflectionAnswer[],
): Promise<Result<Reflection>> {
  const validated = reflectionSchema.safeParse({ weekStart, answers });
  if (!validated.success) {
    return err({
      code: "VALIDATION_ERROR",
      message: "Invalid reflection",
      fields: validated.error.flatten().fieldErrors,
    });
  }

  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  // Only ethics_answers is supplied, so an existing report's narrative/stats are
  // preserved on conflict; a fresh row gets narrative = null (allowed by 0004).
  const { error } = await ctx.value.supabase.from("weekly_reports").upsert(
    {
      workspace_id: ctx.value.workspaceId,
      week_start: validated.data.weekStart,
      ethics_answers: answersToJson(validated.data.answers),
    },
    { onConflict: "workspace_id,week_start" },
  );

  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  revalidatePath("/ethics");
  return ok({ weekStart: validated.data.weekStart, answers: validated.data.answers });
}
