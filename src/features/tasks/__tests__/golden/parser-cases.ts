import type { ParsedTaskResult } from "../../types";

export interface GoldenCase {
  name: string;
  input: string;
  /** Raw model content as returned by OpenRouter (may include prose/fences). */
  modelContent: string;
  expected: ParsedTaskResult;
}

/**
 * Golden dataset for the AI task parser. Each case fixes a model response
 * (static input → expected structured output) so the parser's extraction,
 * validation, and clamping are graded deterministically — never model quality.
 */
export const GOLDEN_CASES: GoldenCase[] = [
  {
    name: "explicit due date",
    input: "Submit the tax report by 2026-07-15",
    modelContent:
      '{"title":"Submit the tax report","priority":"high","tags":["finance"],"dueDate":"2026-07-15","estimatedMinutes":60,"confidence":0.9}',
    expected: {
      title: "Submit the tax report",
      priority: "high",
      tags: ["finance"],
      dueDate: "2026-07-15",
      estimatedMinutes: 60,
      confidence: 0.9,
    },
  },
  {
    name: "relative date resolved to ISO",
    input: "Call the dentist tomorrow",
    modelContent:
      '{"title":"Call the dentist","priority":"medium","tags":["health"],"dueDate":"2026-06-17","estimatedMinutes":10,"confidence":0.8}',
    expected: {
      title: "Call the dentist",
      priority: "medium",
      tags: ["health"],
      dueDate: "2026-06-17",
      estimatedMinutes: 10,
      confidence: 0.8,
    },
  },
  {
    name: "urgent keyword bumps priority",
    input: "URGENT: production is down, fix the deploy now",
    modelContent:
      '{"title":"Fix the production deploy","priority":"urgent","tags":["ops","incident"],"dueDate":null,"estimatedMinutes":120,"confidence":0.95}',
    expected: {
      title: "Fix the production deploy",
      priority: "urgent",
      tags: ["ops", "incident"],
      dueDate: null,
      estimatedMinutes: 120,
      confidence: 0.95,
    },
  },
  {
    name: "tag inference, no date",
    input: "Write blog post about TypeScript generics",
    modelContent:
      '{"title":"Write blog post about TypeScript generics","priority":"low","tags":["writing","typescript"],"dueDate":null,"estimatedMinutes":90,"confidence":0.7}',
    expected: {
      title: "Write blog post about TypeScript generics",
      priority: "low",
      tags: ["writing", "typescript"],
      dueDate: null,
      estimatedMinutes: 90,
      confidence: 0.7,
    },
  },
  {
    name: "no estimate provided (null)",
    input: "Think about Q4 strategy",
    modelContent:
      '{"title":"Think about Q4 strategy","priority":"medium","tags":["strategy"],"dueDate":null,"estimatedMinutes":null,"confidence":0.5}',
    expected: {
      title: "Think about Q4 strategy",
      priority: "medium",
      tags: ["strategy"],
      dueDate: null,
      estimatedMinutes: null,
      confidence: 0.5,
    },
  },
  {
    name: "empty tags array",
    input: "Buy milk",
    modelContent:
      '{"title":"Buy milk","priority":"low","tags":[],"dueDate":null,"estimatedMinutes":5,"confidence":0.6}',
    expected: {
      title: "Buy milk",
      priority: "low",
      tags: [],
      dueDate: null,
      estimatedMinutes: 5,
      confidence: 0.6,
    },
  },
  {
    name: "markdown-fenced JSON is unwrapped",
    input: "Prepare slides for Monday standup",
    modelContent:
      '```json\n{"title":"Prepare standup slides","priority":"medium","tags":["meeting"],"dueDate":"2026-06-22","estimatedMinutes":45,"confidence":0.85}\n```',
    expected: {
      title: "Prepare standup slides",
      priority: "medium",
      tags: ["meeting"],
      dueDate: "2026-06-22",
      estimatedMinutes: 45,
      confidence: 0.85,
    },
  },
  {
    name: "prose around JSON is stripped",
    input: "Renew domain registration",
    modelContent:
      'Sure! Here is the task:\n{"title":"Renew domain registration","priority":"high","tags":["admin"],"dueDate":"2026-06-30","estimatedMinutes":15,"confidence":0.88} Hope that helps.',
    expected: {
      title: "Renew domain registration",
      priority: "high",
      tags: ["admin"],
      dueDate: "2026-06-30",
      estimatedMinutes: 15,
      confidence: 0.88,
    },
  },
  {
    name: "confidence above 1 is clamped to 1",
    input: "Definitely do this thing",
    modelContent:
      '{"title":"Do this thing","priority":"medium","tags":[],"dueDate":null,"estimatedMinutes":null,"confidence":1.5}',
    expected: {
      title: "Do this thing",
      priority: "medium",
      tags: [],
      dueDate: null,
      estimatedMinutes: null,
      confidence: 1,
    },
  },
  {
    name: "negative confidence is clamped to 0",
    input: "Maybe consider rewriting the parser",
    modelContent:
      '{"title":"Consider rewriting the parser","priority":"low","tags":["eng"],"dueDate":null,"estimatedMinutes":null,"confidence":-0.4}',
    expected: {
      title: "Consider rewriting the parser",
      priority: "low",
      tags: ["eng"],
      dueDate: null,
      estimatedMinutes: null,
      confidence: 0,
    },
  },
  {
    name: "high priority with multiple tags",
    input: "Coordinate the launch comms with marketing and PR",
    modelContent:
      '{"title":"Coordinate launch comms","priority":"high","tags":["marketing","pr","launch"],"dueDate":"2026-07-05","estimatedMinutes":180,"confidence":0.82}',
    expected: {
      title: "Coordinate launch comms",
      priority: "high",
      tags: ["marketing", "pr", "launch"],
      dueDate: "2026-07-05",
      estimatedMinutes: 180,
      confidence: 0.82,
    },
  },
];
