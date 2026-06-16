import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  createTaskFromText: vi.fn(),
  createTask: vi.fn(),
}));

vi.mock("../actions", () => ({
  createTaskFromText: h.createTaskFromText,
  createTask: h.createTask,
}));

const { QuickAdd } = await import("../QuickAdd");

beforeEach(() => {
  h.createTaskFromText.mockReset();
  h.createTask.mockReset();
});

describe("QuickAdd", () => {
  it("disables actions until there is input", () => {
    render(<QuickAdd />);
    expect(screen.getByRole("button", { name: "Add with AI" })).toBeDisabled();
  });

  it("creates a task with AI and shows confidence", async () => {
    h.createTaskFromText.mockResolvedValue({
      ok: true,
      value: { parsed: { title: "Email client" }, confidence: 0.82 },
    });
    const user = userEvent.setup();
    render(<QuickAdd />);

    await user.type(screen.getByLabelText("New task"), "email the client");
    await user.click(screen.getByRole("button", { name: "Add with AI" }));

    await waitFor(() => {
      expect(screen.getByText(/Added “Email client”/)).toBeInTheDocument();
    });
    expect(screen.getByText(/82% confidence/)).toBeInTheDocument();
    expect(h.createTaskFromText).toHaveBeenCalledWith("email the client");
  });

  it("surfaces an error and supports the manual fallback", async () => {
    h.createTaskFromText.mockResolvedValue({
      ok: false,
      error: { code: "AI_ERROR", message: "boom" },
    });
    h.createTask.mockResolvedValue({ ok: true, value: { title: "raw task" } });
    const user = userEvent.setup();
    render(<QuickAdd />);

    await user.type(screen.getByLabelText("New task"), "raw task");
    await user.click(screen.getByRole("button", { name: "Add with AI" }));

    await waitFor(() => {
      expect(screen.getByText(/try adding it manually/)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Add manually" }));
    await waitFor(() => {
      expect(screen.getByText(/Added “raw task”/)).toBeInTheDocument();
    });
    expect(h.createTask).toHaveBeenCalledWith({ title: "raw task", priority: "medium", tags: [] });
  });

  it("shows an error when manual creation fails", async () => {
    h.createTask.mockResolvedValue({ ok: false, error: { code: "DB_ERROR", message: "x" } });
    const user = userEvent.setup();
    render(<QuickAdd />);

    await user.type(screen.getByLabelText("New task"), "something");
    await user.click(screen.getByRole("button", { name: "Add manually" }));

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    });
  });

  it.each([
    ["UNAUTHORIZED", /Please sign in/],
    ["VALIDATION_ERROR", /doesn't look like a valid task/],
  ] as const)("maps %s to a friendly message", async (code, pattern) => {
    h.createTaskFromText.mockResolvedValue({ ok: false, error: { code, message: "x" } });
    const user = userEvent.setup();
    render(<QuickAdd />);

    await user.type(screen.getByLabelText("New task"), "do a thing");
    await user.click(screen.getByRole("button", { name: "Add with AI" }));

    await waitFor(() => {
      expect(screen.getByText(pattern)).toBeInTheDocument();
    });
  });
});
