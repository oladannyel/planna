import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BoardToolbar } from "../BoardToolbar";
import type { ToolbarTab } from "../BoardToolbar";

const TABS: ToolbarTab[] = [
  { value: null, label: "All tasks", count: 14 },
  { value: "todo", label: "To do", count: 3 },
  { value: "in_progress", label: "In progress", count: 4 },
  { value: "done", label: "Done", count: 4 },
  { value: "cancelled", label: "Cancelled", count: 3 },
];

describe("BoardToolbar", () => {
  it("renders a tab per status plus All tasks", () => {
    render(<BoardToolbar tabs={TABS} active={null} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("tab")).toHaveLength(5);
  });

  it("shows the count beside each tab", () => {
    render(<BoardToolbar tabs={TABS} active={null} onSelect={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /All tasks 14/ })).toBeVisible();
    expect(screen.getByRole("tab", { name: /To do 3/ })).toBeVisible();
  });

  it("marks only the active tab as selected", () => {
    render(<BoardToolbar tabs={TABS} active="todo" onSelect={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /To do/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /All tasks/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("reports the selected filter", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<BoardToolbar tabs={TABS} active={null} onSelect={onSelect} />);
    await user.click(screen.getByRole("tab", { name: /In progress/ }));
    expect(onSelect).toHaveBeenCalledWith("in_progress");
  });

  it("reports null when All tasks is chosen", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<BoardToolbar tabs={TABS} active="todo" onSelect={onSelect} />);
    await user.click(screen.getByRole("tab", { name: /All tasks/ }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("labels the tablist for screen readers", () => {
    render(<BoardToolbar tabs={TABS} active={null} onSelect={vi.fn()} />);
    expect(screen.getByRole("tablist", { name: "Filter tasks by status" })).toBeInTheDocument();
  });

  it("disables Filter & sort until the feature exists", () => {
    render(<BoardToolbar tabs={TABS} active={null} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Filter & sort/i })).toBeDisabled();
  });

  it("omits Add task when no handler is supplied", () => {
    render(<BoardToolbar tabs={TABS} active={null} onSelect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Add task/i })).not.toBeInTheDocument();
  });

  it("fires the add handler", async () => {
    const onAddTask = vi.fn();
    const user = userEvent.setup();
    render(<BoardToolbar tabs={TABS} active={null} onSelect={vi.fn()} onAddTask={onAddTask} />);
    await user.click(screen.getByRole("button", { name: /Add task/i }));
    expect(onAddTask).toHaveBeenCalledOnce();
  });
});
