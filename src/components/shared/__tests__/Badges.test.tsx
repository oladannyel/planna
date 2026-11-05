import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TaskPriority, TaskStatus } from "@/features/tasks/types";

import { Badge } from "../Badge";
import { PriorityBadge } from "../PriorityBadge";
import { StatusBadge } from "../StatusBadge";

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>planning</Badge>);
    expect(screen.getByText("planning")).toBeVisible();
  });

  it.each(["neutral", "brand", "success", "warning", "danger", "muted"] as const)(
    "renders the %s tone",
    (tone) => {
      render(<Badge tone={tone}>{tone}</Badge>);
      expect(screen.getByText(tone)).toBeVisible();
    },
  );

  it("merges a custom className", () => {
    render(<Badge className="extra-class">tagged</Badge>);
    expect(screen.getByText("tagged")).toHaveClass("extra-class");
  });
});

describe("StatusBadge", () => {
  const cases: [TaskStatus, string][] = [
    ["todo", "To do"],
    ["in_progress", "In progress"],
    ["done", "Done"],
    ["cancelled", "Cancelled"],
  ];

  it.each(cases)("labels %s as %s", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeVisible();
  });

  it("strikes through cancelled only", () => {
    const { rerender } = render(<StatusBadge status="cancelled" />);
    expect(screen.getByText("Cancelled")).toHaveClass("line-through");
    rerender(<StatusBadge status="done" />);
    expect(screen.getByText("Done")).not.toHaveClass("line-through");
  });
});

describe("PriorityBadge", () => {
  const cases: [TaskPriority, string][] = [
    ["low", "Low"],
    ["medium", "Medium"],
    ["high", "High"],
    ["urgent", "Urgent"],
  ];

  it.each(cases)("labels %s as %s", (priority, label) => {
    render(<PriorityBadge priority={priority} />);
    expect(screen.getByText(label)).toBeVisible();
  });
});
