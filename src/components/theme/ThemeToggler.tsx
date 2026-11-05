"use client";

import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/cn";

import { useTheme } from "./ThemeProvider";

/**
 * Light/dark switch. Renders the icon for the theme it will switch *to*, which
 * is the convention users expect from a single-button toggle.
 */
export function ThemeToggler({ className }: { className?: string }): JSX.Element {
  const { resolvedTheme, toggleTheme } = useTheme();
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border",
        "text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple",
        className,
      )}
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
