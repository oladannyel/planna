import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "../Sidebar";
import { SidebarProvider } from "../SidebarProvider";

vi.mock("next/navigation", () => ({ usePathname: () => "/board" }));

function renderSidebar() {
  return render(
    <SidebarProvider>
      <Sidebar workspaceName="Demo Workspace" />
    </SidebarProvider>,
  );
}

describe("Sidebar", () => {
  beforeEach(() => window.localStorage.clear());

  it("renders grouped navigation", () => {
    renderSidebar();
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it("marks the active route with aria-current", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: /Board/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Daily/ })).not.toHaveAttribute("aria-current");
  });

  it("shows the workspace name", () => {
    renderSidebar();
    expect(screen.getByText("Demo Workspace")).toBeVisible();
  });

  it("flags upcoming routes", () => {
    renderSidebar();
    expect(screen.getByText("soon")).toBeVisible();
  });

  it("collapses to an icon rail and back", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
  });

  it("persists the collapsed state", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(window.localStorage.getItem("planna-sidebar-collapsed")).toBe("true");
  });

  it("keeps labels reachable to screen readers when collapsed", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.getByRole("link", { name: /Board/ })).toBeInTheDocument();
  });
});
