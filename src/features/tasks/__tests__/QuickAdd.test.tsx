import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  createMultipleTasksFromText: vi.fn(),
  createTask: vi.fn(),
}));

vi.mock("../actions", () => ({
  createMultipleTasksFromText: h.createMultipleTasksFromText,
  createTask: h.createTask,
}));

const { QuickAdd } = await import("../QuickAdd");

beforeEach(() => {
  h.createMultipleTasksFromText.mockReset();
  h.createTask.mockReset();
});

describe("QuickAdd", () => {
  it("disables actions until there is input", () => {
    render(<QuickAdd />);
    expect(screen.getByRole("button", { name: "Add with AI" })).toBeDisabled();
  });

  it("parses a blob and shows a created/skipped/failed summary", async () => {
    h.createMultipleTasksFromText.mockResolvedValue({
      ok: true,
      value: { created: [{ id: "1" }, { id: "2" }], skipped: 1, errors: ["x"] },
    });
    const user = userEvent.setup();
    render(<QuickAdd />);

    await user.type(screen.getByLabelText("New task"), "task a\ntask b - DONE\nskip me - SKIP");
    await user.click(screen.getByRole("button", { name: "Add with AI" }));

    await waitFor(() => {
      expect(screen.getByText(/2 tasks created/)).toBeInTheDocument();
    });
    expect(screen.getByText(/1 skipped/)).toBeInTheDocument();
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    expect(h.createMultipleTasksFromText).toHaveBeenCalledWith(
      "task a\ntask b - DONE\nskip me - SKIP",
    );
  });

  it("uses singular wording for a single created task", async () => {
    h.createMultipleTasksFromText.mockResolvedValue({
      ok: true,
      value: { created: [{ id: "1" }], skipped: 0, errors: [] },
    });
    const user = userEvent.setup();
    render(<QuickAdd />);
    await user.type(screen.getByLabelText("New task"), "one thing");
    await user.click(screen.getByRole("button", { name: "Add with AI" }));
    await waitFor(() => expect(screen.getByText(/1 task created/)).toBeInTheDocument());
  });

  it("shows an error when no tasks are found", async () => {
    h.createMultipleTasksFromText.mockResolvedValue({
      ok: true,
      value: { created: [], skipped: 0, errors: [] },
    });
    const user = userEvent.setup();
    render(<QuickAdd />);
    await user.type(screen.getByLabelText("New task"), "blah");
    await user.click(screen.getByRole("button", { name: "Add with AI" }));
    await waitFor(() => expect(screen.getByText(/No tasks found/)).toBeInTheDocument());
  });

  it("surfaces a parser error and supports the manual fallback", async () => {
    h.createMultipleTasksFromText.mockResolvedValue({
      ok: false,
      error: { code: "AI_ERROR", message: "boom" },
    });
    h.createTask.mockResolvedValue({ ok: true, value: { title: "raw task" } });
    const user = userEvent.setup();
    render(<QuickAdd />);

    await user.type(screen.getByLabelText("New task"), "raw task");
    await user.click(screen.getByRole("button", { name: "Add with AI" }));
    await waitFor(() => expect(screen.getByText(/try adding manually/)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Add manually" }));
    await waitFor(() => expect(screen.getByText(/Added “raw task”/)).toBeInTheDocument());
    expect(h.createTask).toHaveBeenCalledWith({ title: "raw task", priority: "medium", tags: [] });
  });

  it("shows an error when manual creation fails", async () => {
    h.createTask.mockResolvedValue({ ok: false, error: { code: "DB_ERROR", message: "x" } });
    const user = userEvent.setup();
    render(<QuickAdd />);

    await user.type(screen.getByLabelText("New task"), "something");
    await user.click(screen.getByRole("button", { name: "Add manually" }));
    await waitFor(() => expect(screen.getByText(/Something went wrong/)).toBeInTheDocument());
  });

  it.each([
    ["UNAUTHORIZED", /Please sign in/],
    ["VALIDATION_ERROR", /doesn't look like a valid task/],
  ] as const)("maps %s to a friendly message", async (code, pattern) => {
    h.createMultipleTasksFromText.mockResolvedValue({ ok: false, error: { code, message: "x" } });
    const user = userEvent.setup();
    render(<QuickAdd />);

    await user.type(screen.getByLabelText("New task"), "do a thing");
    await user.click(screen.getByRole("button", { name: "Add with AI" }));
    await waitFor(() => expect(screen.getByText(pattern)).toBeInTheDocument());
  });
});
