import { describe, expect, it } from "vitest";

import { ethicsQuestionSchema, reflectionSchema } from "../schema";

describe("ethicsQuestionSchema", () => {
  it("accepts a valid question", () => {
    expect(ethicsQuestionSchema.safeParse({ question: "Did I act with integrity?" }).success).toBe(
      true,
    );
  });

  it("rejects empty or overlong questions", () => {
    expect(ethicsQuestionSchema.safeParse({ question: "" }).success).toBe(false);
    expect(ethicsQuestionSchema.safeParse({ question: "x".repeat(301) }).success).toBe(false);
  });
});

describe("reflectionSchema", () => {
  it("accepts a valid reflection", () => {
    const result = reflectionSchema.safeParse({
      weekStart: "2026-06-15",
      answers: [{ questionId: "q1", question: "Q?", answer: "Yes." }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty answers array", () => {
    expect(reflectionSchema.safeParse({ weekStart: "2026-06-15", answers: [] }).success).toBe(true);
  });

  it("rejects a malformed weekStart", () => {
    expect(reflectionSchema.safeParse({ weekStart: "06/15/2026", answers: [] }).success).toBe(
      false,
    );
  });
});
