import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider, ThemeToggler, THEME_STORAGE_KEY, useTheme } from "..";

/** Drives matchMedia so `system` can be exercised in jsdom. */
function mockMatchMedia(prefersDark: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: prefersDark,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  });
}

function Probe(): JSX.Element {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme("system")}>use system</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
    mockMatchMedia(false);
  });

  it("defaults to dark when nothing is stored", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(await screen.findByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("restores a stored light preference", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(await screen.findByTestId("resolved")).toHaveTextContent("light");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("resolves `system` against the OS preference", async () => {
    mockMatchMedia(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(await screen.findByTestId("theme")).toHaveTextContent("system");
    expect(await screen.findByTestId("resolved")).toHaveTextContent("dark");
  });

  it("persists a change to storage", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "use system" }));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });

  it("ignores an unrecognised stored value", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "chartreuse");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(await screen.findByTestId("theme")).toHaveTextContent("dark");
  });

  it("throws when useTheme is used outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/within a ThemeProvider/);
    spy.mockRestore();
  });
});

describe("ThemeToggler", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
    mockMatchMedia(false);
  });

  it("switches dark to light and back", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggler />
      </ThemeProvider>,
    );

    const toggle = await screen.findByRole("button", { name: /switch to light mode/i });
    await user.click(toggle);

    expect(document.documentElement).not.toHaveClass("dark");
    const back = screen.getByRole("button", { name: /switch to dark mode/i });
    await user.click(back);
    expect(document.documentElement).toHaveClass("dark");
  });

  it("labels the theme it switches to, not the current one", async () => {
    render(
      <ThemeProvider>
        <ThemeToggler />
      </ThemeProvider>,
    );
    expect(await screen.findByRole("button", { name: /switch to light mode/i })).toBeVisible();
  });
});
