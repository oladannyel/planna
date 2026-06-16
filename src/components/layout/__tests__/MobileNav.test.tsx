import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MobileNav } from "../MobileNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/daily",
}));

describe("MobileNav", () => {
  it("shows only the mobile nav items", () => {
    render(<MobileNav />);
    expect(screen.getByRole("link", { name: "Board" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Monthly" })).toBeInTheDocument();
    // Desktop-only items are not in the mobile bar.
    expect(screen.queryByRole("link", { name: "Analytics" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ethics" })).not.toBeInTheDocument();
  });

  it("highlights the active route", () => {
    render(<MobileNav />);
    expect(screen.getByRole("link", { name: "Daily" }).className).toContain("text-purple");
  });
});
