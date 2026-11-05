/**
 * WCAG relative-luminance and contrast maths.
 *
 * Exists so the token palette can be asserted against WCAG AA in the test
 * suite rather than checked by eye once and then quietly broken. Contrast
 * regressions are invisible in review — a hex changes by a few points and
 * nothing looks obviously wrong until someone cannot read it.
 */
export type Rgb = readonly [number, number, number];

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance. */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1–21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA: 4.5:1 for normal text, 3:1 for large text. */
export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;
