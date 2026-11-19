import { cn } from "@/lib/cn";

import type { ChartPalette } from "./chart-palette";

/**
 * A legend in real markup.
 *
 * Recharts' built-in legend draws its labels as SVG text with its own inline
 * colours, which the theme cannot reach — that is how the old chart ended up
 * with a legend in a colour the palette does not define. These are spans: they
 * take text tokens like everything else, they wrap, and they can sit in the
 * card header where a legend belongs rather than under the plot.
 */
export function ChartLegend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-text-secondary">
          <span className={cn("h-2.5 w-2.5 rounded-full", item.className)} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Tooltip chrome, shared so the two charts cannot drift apart. */
export function tooltipStyles(palette: ChartPalette): React.CSSProperties {
  return {
    background: palette.tooltipBg,
    border: `1px solid ${palette.tooltipBorder}`,
    borderRadius: 12,
    color: palette.tooltipText,
    fontSize: 12,
    boxShadow: "0px 12px 16px -4px rgba(16, 24, 40, 0.16)",
  };
}
