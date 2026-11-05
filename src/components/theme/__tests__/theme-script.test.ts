import { describe, expect, it } from "vitest";

import { themeInitScript } from "../theme-script";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "../types";

describe("themeInitScript", () => {
  it("references the same storage key the provider uses", () => {
    expect(themeInitScript).toContain(THEME_STORAGE_KEY);
  });

  it("embeds the default theme", () => {
    expect(themeInitScript).toContain(`'${DEFAULT_THEME}'`);
  });

  it("guards every storage access, since localStorage throws in private mode", () => {
    expect(themeInitScript).toMatch(/try\s*{[^}]*localStorage/);
  });

  it("falls back to dark if anything throws", () => {
    expect(themeInitScript).toContain("classList.add('dark')");
  });

  it("is an IIFE so it leaks nothing into global scope", () => {
    expect(themeInitScript.startsWith("(function ()")).toBe(true);
    expect(themeInitScript.endsWith("})();")).toBe(true);
  });

  it("runs without throwing and applies a theme", () => {
    document.documentElement.classList.remove("dark");
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function(themeInitScript)();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
