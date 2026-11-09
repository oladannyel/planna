import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { AA_NORMAL, contrastRatio, luminance } from "../contrast";
import type { Rgb } from "../contrast";

/**
 * The theme tokens, read from `globals.css` itself.
 *
 * These used to be hand-copied into this file, under a comment warning that
 * "if a token changes there and not here, these tests pass while the app
 * regresses". That is exactly what happened: the dark `text-muted` here said
 * [126, 140, 160] while the stylesheet shipped [71, 85, 105], so this suite
 * certified 4.75:1 for a colour that actually rendered at 2.14:1. A warning
 * comment is not a control. Parsing the stylesheet makes the drift
 * impossible rather than merely discouraged.
 */
function readThemeTokens(): { LIGHT: Record<string, Rgb>; DARK: Record<string, Rgb> } {
  const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");
  const themes: Record<string, Record<string, Rgb>> = { light: {}, dark: {} };
  let current: string | null = null;

  for (const line of css.split("\n")) {
    if (/^\s*:root\s*\{/.test(line)) current = "light";
    else if (/^\s*\.dark\s*\{/.test(line)) current = "dark";

    const match = line.match(/--color-([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/);
    if (match && current) {
      const [, name, r, g, b] = match;
      themes[current]![name!] = [Number(r), Number(g), Number(b)];
    }
  }

  if (Object.keys(themes.light!).length === 0 || Object.keys(themes.dark!).length === 0) {
    throw new Error("Could not read theme tokens from globals.css");
  }
  return { LIGHT: themes.light!, DARK: themes.dark! };
}

const { LIGHT, DARK } = readThemeTokens();

const FOREGROUNDS = [
  "text-primary",
  "text-secondary",
  "text-muted",
  "purple-ink",
  "teal",
  "amber",
  "danger-ink",
] as const;

const SURFACES = ["canvas", "card"] as const;

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1);
  });

  it("is 1 for a colour against itself", () => {
    expect(contrastRatio([124, 58, 237], [124, 58, 237])).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    const a: Rgb = [16, 24, 40];
    const b: Rgb = [255, 255, 255];
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });
});

describe("luminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(luminance([0, 0, 0])).toBeCloseTo(0, 5);
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 5);
  });
});

describe("palette meets WCAG AA", () => {
  for (const theme of [
    { name: "light", tokens: LIGHT },
    { name: "dark", tokens: DARK },
  ]) {
    for (const fg of FOREGROUNDS) {
      for (const bg of SURFACES) {
        it(`${theme.name}: ${fg} on ${bg}`, () => {
          const foreground = theme.tokens[fg];
          const background = theme.tokens[bg];
          expect(foreground).toBeDefined();
          expect(background).toBeDefined();
          const ratio = contrastRatio(foreground as Rgb, background as Rgb);
          expect(
            ratio,
            `${fg} on ${bg} in ${theme.name} is ${ratio.toFixed(2)}:1, below AA ${AA_NORMAL}:1`,
          ).toBeGreaterThanOrEqual(AA_NORMAL);
        });
      }
    }
  }

  it("keeps white legible on the purple button fill in both themes", () => {
    expect(contrastRatio([255, 255, 255], [124, 58, 237])).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrastRatio([255, 255, 255], [109, 40, 217])).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});
