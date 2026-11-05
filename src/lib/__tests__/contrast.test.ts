import { describe, expect, it } from "vitest";

import { AA_NORMAL, contrastRatio, luminance } from "../contrast";
import type { Rgb } from "../contrast";

/**
 * Must mirror the custom properties in `globals.css`. If a token changes
 * there and not here, these tests pass while the app regresses — so treat a
 * change in one as requiring a change in the other.
 */
const LIGHT: Record<string, Rgb> = {
  canvas: [249, 250, 251],
  card: [255, 255, 255],
  "text-primary": [16, 24, 40],
  "text-secondary": [71, 84, 103],
  "text-muted": [102, 112, 133],
  "purple-ink": [109, 40, 217],
  teal: [15, 118, 110],
  amber: [180, 71, 8],
  "danger-ink": [180, 35, 24],
};

const DARK: Record<string, Rgb> = {
  canvas: [15, 15, 19],
  card: [23, 23, 31],
  "text-primary": [248, 250, 252],
  "text-secondary": [148, 163, 184],
  "text-muted": [126, 140, 160],
  "purple-ink": [167, 139, 250],
  teal: [13, 148, 136],
  amber: [217, 119, 6],
  "danger-ink": [249, 112, 102],
};

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
