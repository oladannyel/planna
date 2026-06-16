import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EthicsQuestion, Reflection } from "../types";

const h = vi.hoisted(() => ({
  saveReflection: vi.fn(),
  addQuestion: vi.fn(),
  deactivateQuestion: vi.fn(),
}));

vi.mock("../actions", () => ({
  saveReflection: h.saveReflection,
  addQuestion: h.addQuestion,
  deactivateQuestion: h.deactivateQuestion,
}));

const { EthicsCheckin } = await import("../EthicsCheckin");
const { QuestionManager } = await import("../QuestionManager");
const { ReflectionHistory } = await import("../ReflectionHistory");

const questions: EthicsQuestion[] = [
  { id: "q1", question: "Was I fair?", sortOrder: 0, active: true },
  { id: "q2", question: "Did I focus?", sortOrder: 1, active: true },
];

beforeEach(() => {
  h.saveReflection.mockReset();
  h.addQuestion.mockReset();
  h.deactivateQuestion.mockReset();
});

describe("EthicsCheckin", () => {
  it("shows an empty state with no questions", () => {
    render(<EthicsCheckin weekStart="2026-06-15" questions={[]} initialAnswers={[]} />);
    expect(screen.getByText("No reflection questions yet")).toBeInTheDocument();
  });

  it("prefills initial answers and saves all answers", async () => {
    h.saveReflection.mockResolvedValue({
      ok: true,
      value: { weekStart: "2026-06-15", answers: [] },
    });
    const user = userEvent.setup();
    render(
      <EthicsCheckin
        weekStart="2026-06-15"
        questions={questions}
        initialAnswers={[{ questionId: "q1", question: "Was I fair?", answer: "Mostly." }]}
      />,
    );
    expect(screen.getByDisplayValue("Mostly.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Did I focus?"), "Yes");
    await user.click(screen.getByRole("button", { name: "Save reflection" }));

    await waitFor(() => expect(screen.getByText("Saved.")).toBeInTheDocument());
    const [weekStart, answers] = h.saveReflection.mock.calls[0] ?? [];
    expect(weekStart).toBe("2026-06-15");
    expect(answers).toHaveLength(2);
  });

  it("shows an error when saving fails", async () => {
    h.saveReflection.mockResolvedValue({ ok: false, error: { code: "DB_ERROR", message: "x" } });
    const user = userEvent.setup();
    render(<EthicsCheckin weekStart="2026-06-15" questions={questions} initialAnswers={[]} />);
    await user.click(screen.getByRole("button", { name: "Save reflection" }));
    await waitFor(() => expect(screen.getByText(/Couldn't save/)).toBeInTheDocument());
  });
});

describe("QuestionManager", () => {
  it("adds a question", async () => {
    h.addQuestion.mockResolvedValue({ ok: true, value: questions[0] });
    const user = userEvent.setup();
    render(<QuestionManager questions={questions} />);

    await user.type(screen.getByLabelText("New reflection question"), "New one?");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(h.addQuestion).toHaveBeenCalledWith("New one?"));
  });

  it("deactivates a question", async () => {
    h.deactivateQuestion.mockResolvedValue({ ok: true, value: { id: "q1" } });
    const user = userEvent.setup();
    render(<QuestionManager questions={questions} />);

    await user.click(screen.getByRole("button", { name: "Remove: Was I fair?" }));
    await waitFor(() => expect(h.deactivateQuestion).toHaveBeenCalledWith("q1"));
  });

  it("shows a hint when there are no questions", () => {
    render(<QuestionManager questions={[]} />);
    expect(screen.getByText("No questions yet.")).toBeInTheDocument();
  });
});

describe("ReflectionHistory", () => {
  it("renders nothing when empty", () => {
    const { container } = render(<ReflectionHistory reflections={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders past reflections grouped by week", () => {
    const reflections: Reflection[] = [
      {
        weekStart: "2026-06-08",
        answers: [{ questionId: "q1", question: "Was I fair?", answer: "Yes." }],
      },
    ];
    render(<ReflectionHistory reflections={reflections} />);
    expect(screen.getByText("Week of 2026-06-08")).toBeInTheDocument();
    expect(screen.getByText("Yes.")).toBeInTheDocument();
  });
});
