import { z } from "zod";

import type { Database } from "@/types/database";

import type { EthicsQuestion, ReflectionAnswer } from "./types";

type QuestionRow = Database["public"]["Tables"]["ethics_questions"]["Row"];

export function rowToQuestion(row: QuestionRow): EthicsQuestion {
  return {
    id: row.id,
    question: row.question,
    sortOrder: row.sort_order,
    active: row.active,
  };
}

const answersSchema: z.ZodType<ReflectionAnswer[]> = z.array(
  z.object({
    questionId: z.string(),
    question: z.string(),
    answer: z.string(),
  }),
);

/** Safely parse the `ethics_answers` JSONB into typed answers; `[]` on null/malformed. */
export function parseAnswers(value: unknown): ReflectionAnswer[] {
  const result = answersSchema.safeParse(value);
  return result.success ? result.data : [];
}
