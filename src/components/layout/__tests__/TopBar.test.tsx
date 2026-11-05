import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/components/theme";

import { SidebarProvider } from "../SidebarProvider";
import { TopBar } from "../TopBar";

// TopBar reads both theme and sidebar context (the theme toggle and the
// mobile nav button), so it renders inside both providers. jsdom has no
// matchMedia, which ThemeProvider needs.
function renderTopBar(email = "dan@planna.com") {
  return render(
    <ThemeProvider>
      <SidebarProvider>
        <TopBar email={email} />
      </SidebarProvider>
    </ThemeProvider>,
  );
}

describe("TopBar", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
      })),
    });
    window.localStorage.clear();
  });

  it("shows the user email", () => {
    renderTopBar();
    expect(screen.getByText("dan@planna.com")).toBeInTheDocument();
  });

  it("posts to the sign-out route", () => {
    const { container } = renderTopBar();
    const form = container.querySelector("form");
    expect(form?.getAttribute("action")).toBe("/auth/signout");
    expect(form?.getAttribute("method")).toBe("post");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("offers the theme toggle", async () => {
    renderTopBar();
    expect(await screen.findByRole("button", { name: /switch to .* mode/i })).toBeInTheDocument();
  });

  it("offers a search field", () => {
    renderTopBar();
    expect(screen.getByRole("searchbox", { name: "Search tasks" })).toBeInTheDocument();
  });

  it("exposes the mobile navigation trigger", () => {
    renderTopBar();
    expect(screen.getByRole("button", { name: "Open navigation" })).toBeInTheDocument();
  });
});
