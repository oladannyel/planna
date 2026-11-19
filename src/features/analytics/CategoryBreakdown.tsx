import { ComponentCard } from "@/components/ui";

import type { TagCount } from "./metrics";

/**
 * Top categories, as ranked bars on a shared baseline.
 *
 * This was a Recharts bar chart, which cost the route a chunk of that library
 * to draw eight rectangles and left the tag names to an axis renderer that
 * clipped them. Ranked bars with the name and the count in real text read
 * more exactly than segments of a donut and need no chart library at all —
 * and the figures are selectable, searchable and sized by the type scale.
 *
 * One hue, not eight: the bars encode magnitude, and rank is already carried
 * by the order. Colour per tag would be identity the reader cannot use.
 */
export function CategoryBreakdown({ data }: { data: TagCount[] }) {
  const max = data.reduce((highest, item) => Math.max(highest, item.count), 0);

  return (
    <ComponentCard
      title="Top categories"
      description="Tags across every task, most used first."
      contentClassName="px-5 pb-5"
    >
      {data.length === 0 ? (
        <p className="text-sm text-text-muted">No tagged tasks yet.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((item) => (
            <li key={item.tag}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm text-text-primary">{item.tag}</span>
                <span className="font-display text-sm font-semibold tabular-nums text-text-secondary">
                  {item.count}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-field">
                <div
                  className="h-full rounded-full bg-chart-1"
                  style={{ width: `${max === 0 ? 0 : Math.round((item.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </ComponentCard>
  );
}
