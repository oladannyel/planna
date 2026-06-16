import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "../Badge";
import { PriorityBadge } from "../PriorityBadge";
import { StatusBadge } from "../StatusBadge";

describe("Badge", () => {
  it("renders children and merges class names", () => {
    render(<Badge className="bg-purple/20">Hello</Badge>);
    const node = screen.getByText("Hello");
    expect(node).toBeInTheDocument();
    expect(node.className).toContain("bg-purple/20");
  });
});

describe("PriorityBadge", () => {
  it.each([
    ["low", "Low"],
    ["medium", "Medium"],
    ["high", "High"],
    ["urgent", "Urgent"],
  ] as const)("renders %s label", (priority, label) => {
    render(<PriorityBadge priority={priority} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe("StatusBadge", () => {
  it.each([
    ["todo", "To do"],
    ["in_progress", "In progress"],
    ["done", "Done"],
    ["cancelled", "Cancelled"],
  ] as const)("renders %s label", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
