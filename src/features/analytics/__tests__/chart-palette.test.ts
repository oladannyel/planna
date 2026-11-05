import { afterEach, describe, expect, it } from "vitest";

import { readChartPalette } from "../chart-palette";

describe("readChartPalette", () => {
  afterEach(() => {
    document.documentElement.style.cssText = "";
  });

  it("reads the live CSS custom properties", () => {
    document.documentElement.style.setProperty("--color-border", "10 20 30");
    document.documentElement.style.setProperty("--color-purple", "124 58 237");

    const palette = readChartPalette();

    expect(palette.grid).toBe("rgb(10 20 30)");
    expect(palette.series).toBe("rgb(124 58 237)");
  });

  it("falls back to the dark palette when a variable is absent", () => {
    const palette = readChartPalette();
    // jsdom resolves no stylesheet, so every lookup is empty and falls back.
    expect(palette.tooltipBg).toBe("rgb(23 23 31)");
    expect(palette.axis).toBe("rgb(148 163 184)");
  });

  it("tracks the theme: light values produce light chart colours", () => {
    document.documentElement.style.setProperty("--color-card", "255 255 255");
    document.documentElement.style.setProperty("--color-text-primary", "16 24 40");

    const palette = readChartPalette();

    expect(palette.tooltipBg).toBe("rgb(255 255 255)");
    expect(palette.tooltipText).toBe("rgb(16 24 40)");
  });
});
