import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "../Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/board",
}));

describe("Sidebar", () => {
  it("renders the workspace name and every nav item", () => {
    render(<Sidebar workspaceName="Acme Inc" />);
    expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    for (const label of [
      "Board",
      "Daily",
      "Weekly",
      "Monthly",
      "Analytics",
      "Reports",
      "Ethics",
      "Yearly",
    ]) {
      expect(screen.getByRole("link", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("marks upcoming items with a 'soon' badge", () => {
    render(<Sidebar workspaceName="Acme Inc" />);
    expect(screen.getByText("soon")).toBeInTheDocument();
  });

  it("highlights the active route", () => {
    render(<Sidebar workspaceName="Acme Inc" />);
    const active = screen.getByRole("link", { name: "Board" });
    expect(active.className).toContain("bg-purple/15");
  });
});
