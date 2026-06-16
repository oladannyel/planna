import { z } from "zod";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const ethicsQuestionSchema = z.object({
  question: z.string().min(1).max(300),
});

export const reflectionSchema = z.object({
  weekStart: z.string().regex(ISO_DATE_RE),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        question: z.string().min(1),
        answer: z.string().max(5000),
      }),
    )
    .max(50),
});

export type EthicsQuestionInput = z.infer<typeof ethicsQuestionSchema>;
export type ReflectionInput = z.infer<typeof reflectionSchema>;
