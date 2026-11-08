"use client";

import { useEffect, useState } from "react";

import { useTheme } from "@/components/theme";

/**
 * Chart colours.
 *
 * Recharts takes colours as props, not class names, so it cannot read Tailwind
 * utilities. Rather than duplicate the palette as hex literals — which is what
 * left the charts dark-only — this reads the same CSS custom properties the
 * rest of the app themes through, and recomputes whenever the theme changes.
 * One source of truth, in `globals.css`.
 */
export interface ChartPalette {
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  series: string;
  seriesAlt: string;
}

/** Variables hold `R G B` channels; Recharts needs a usable colour string. */
function readChannels(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const raw = styles.getPropertyValue(name).trim();
  return raw ? `rgb(${raw})` : fallback;
}

/** Dark values, matching `.dark` in globals.css. Used before mount and in SSR. */
const FALLBACK: ChartPalette = {
  grid: "rgb(30 30 46)",
  axis: "rgb(148 163 184)",
  tooltipBg: "rgb(23 23 31)",
  tooltipBorder: "rgb(30 30 46)",
  tooltipText: "rgb(248 250 252)",
  series: "rgb(124 58 237)",
  seriesAlt: "rgb(13 148 136)",
};

export function readChartPalette(): ChartPalette {
  if (typeof window === "undefined") return FALLBACK;
  const styles = window.getComputedStyle(document.documentElement);
  return {
    grid: readChannels(styles, "--color-border", FALLBACK.grid),
    axis: readChannels(styles, "--color-text-secondary", FALLBACK.axis),
    tooltipBg: readChannels(styles, "--color-card", FALLBACK.tooltipBg),
    tooltipBorder: readChannels(styles, "--color-border", FALLBACK.tooltipBorder),
    tooltipText: readChannels(styles, "--color-text-primary", FALLBACK.tooltipText),
    series: readChannels(styles, "--color-purple", FALLBACK.series),
    seriesAlt: readChannels(styles, "--color-teal", FALLBACK.seriesAlt),
  };
}

export function useChartPalette(): ChartPalette {
  const { resolvedTheme } = useTheme();
  const [palette, setPalette] = useState<ChartPalette>(FALLBACK);

  useEffect(() => {
    /*
     * The palette is read from live CSS custom properties via getComputedStyle,
     * which is only meaningful once the DOM carries the new theme class.
     * Reading earlier returns the previous theme's colours. Recharts takes
     * colours as props rather than classes, so it cannot follow CSS itself.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPalette(readChartPalette());
  }, [resolvedTheme]);

  return palette;
}
