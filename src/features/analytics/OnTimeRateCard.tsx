import { ComponentCard } from "@/components/ui";

interface OnTimeRateCardProps {
  onTimeRate: number;
  scheduledRate: number;
  completionRate: number;
  carryoverRate: number;
}

/**
 * Four ratios, each against its own whole — the shape a meter list is for.
 *
 * They were four bare percentages in a row, which gave the eye nothing to
 * compare: 80% and 33% sat at the same size in the same weight, and the
 * reader had to do the ranking. A track per row does that work, and the
 * figure stays beside it for the exact value.
 *
 * One hue across all four rows, deliberately. These are not four series —
 * giving each its own colour would say they are different kinds of thing and
 * invite the reader to look for meaning in the palette.
 */
function Meter({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-text-secondary">{label}</p>
        <p className="font-display text-sm font-semibold tabular-nums text-text-primary">
          {value}%
        </p>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-field"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${value} percent`}
      >
        <div className="h-full rounded-full bg-chart-1" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-text-muted">{hint}</p>
    </div>
  );
}

export function OnTimeRateCard({
  onTimeRate,
  scheduledRate,
  completionRate,
  carryoverRate,
}: OnTimeRateCardProps) {
  return (
    <ComponentCard
      title="Rates"
      description="How the work is going, as shares rather than counts."
      contentClassName="space-y-5 px-5 pb-5"
    >
      <Meter label="On time" value={onTimeRate} hint="Of completed tasks that had a deadline." />
      <Meter
        label="Scheduled"
        value={scheduledRate}
        hint="Share of your work with a deadline set."
      />
      <Meter label="Completed" value={completionRate} hint="Share of all tasks finished." />
      <Meter label="Carried over" value={carryoverRate} hint="Tasks that outlived the day." />
    </ComponentCard>
  );
}
