"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { ResolvedTheme, ThemePreference } from "./types";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "./types";

interface ThemeContextValue {
  /** What the user chose, including `system`. */
  theme: ThemePreference;
  /** What is actually on the document right now. */
  resolvedTheme: ResolvedTheme;
  setTheme: (next: ThemePreference) => void;
  /** Flips between light and dark, resolving `system` to its opposite. */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStoredTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Private mode or blocked site data — fall through to the default.
  }
  return DEFAULT_THEME;
}

function systemTheme(): ResolvedTheme {
  try {
    return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
  } catch {
    return "dark";
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}

function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  // Initialised from storage on the client. The inline script has already put
  // the right class on <html>, so this only syncs React to that reality.
  const [theme, setThemeState] = useState<ThemePreference>(DEFAULT_THEME);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const stored = readStoredTheme();
    /*
     * localStorage does not exist during SSR, so the stored preference cannot
     * seed useState without a hydration mismatch. This is the rule's own "read
     * from an external system" case; it cannot tell, because the read is
     * synchronous. There is no flash — the pre-paint script in theme-script.ts
     * has already put the right class on <html>; this only catches React up.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(stored);
    const resolved = resolveTheme(stored);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  // Follow the OS while the preference is `system`.
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (): void => {
      const resolved = systemTheme();
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference): void => {
    setThemeState(next);
    const resolved = resolveTheme(next);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Preference is not persisted, but the page still themes correctly.
    }
  }, []);

  const toggleTheme = useCallback((): void => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
