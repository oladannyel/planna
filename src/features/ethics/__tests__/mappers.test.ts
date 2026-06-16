import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

import { parseAnswers, rowToQuestion } from "../mappers";

type QuestionRow = Database["public"]["Tables"]["ethics_questions"]["Row"];

const row: QuestionRow = {
  id: "q1",
  workspace_id: "ws-1",
  question: "Was I fair?",
  sort_order: 2,
  active: true,
  created_at: "2026-06-16T09:00:00.000Z",
};

describe("rowToQuestion", () => {
  it("maps snake_case to the domain shape", () => {
    expect(rowToQuestion(row)).toEqual({
      id: "q1",
      question: "Was I fair?",
      sortOrder: 2,
      active: true,
    });
  });
});

describe("parseAnswers", () => {
  it("parses well-formed answers", () => {
    const answers = [{ questionId: "q1", question: "Q?", answer: "A." }];
    expect(parseAnswers(answers)).toEqual(answers);
  });

  it("returns [] for null/malformed JSON", () => {
    expect(parseAnswers(null)).toEqual([]);
    expect(parseAnswers("nope")).toEqual([]);
    expect(parseAnswers([{ questionId: 1 }])).toEqual([]);
  });
});
