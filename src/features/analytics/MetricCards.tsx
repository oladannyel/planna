import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ListTodo,
  PlusCircle,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/shared";

import type { PeriodDelta } from "./metrics";

/**
 * The headline row.
 *
 * Four stat tiles rather than a chart each: a single current value with a
 * trend is a stat tile's job, and the page previously opened with a flat
 * strip of four percentages that compared to nothing.
 *
 * The delta is the point. A count on its own tells you the size of the
 * backlog; a count against the week before tells you its direction, which is
 * the question someone opens an analytics page to ask.
 */

/**
 * The change badge.
 *
 * An arrow as well as a colour, and the sign spelled out in the accessible
 * name: "up 12% on the previous 7 days" is the whole claim, where a green
 * "12%" leaves the reader to infer both the direction and what it is measured
 * against. Direction is never carried by colour alone.
 */
function DeltaBadge({ delta, period }: { delta: PeriodDelta; period: string }) {
  if (delta.changePct === null) {
    return (
      <Badge tone="muted">
        <span className="sr-only">No comparison: nothing in the previous {period}</span>
        <span aria-hidden>new</span>
      </Badge>
    );
  }

  if (delta.changePct === 0) {
    return (
      <Badge tone="neutral">
        <span className="sr-only">Unchanged on the previous {period}</span>
        <span aria-hidden>0%</span>
      </Badge>
    );
  }

  const up = delta.changePct > 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;

  return (
    <Badge tone={up ? "success" : "danger"}>
      <Arrow className="me-0.5 h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">
        {up ? "Up" : "Down"} {Math.abs(delta.changePct)}% on the previous {period}
      </span>
      <span aria-hidden>{Math.abs(delta.changePct)}%</span>
    </Badge>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  caption,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  caption: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="surface p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-field text-text-secondary">
        <Icon className="h-5 w-5" aria-hidden />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-text-secondary">{label}</p>
          <p className="mt-1 font-display text-title-md font-bold text-text-primary">{value}</p>
        </div>
        {badge ? <div className="shrink-0 pb-1">{badge}</div> : null}
      </div>

      <p className="mt-2 text-xs text-text-muted">{caption}</p>
    </div>
  );
}

export function MetricCards({
  created,
  completed,
  avgCycleTimeHours,
  openTasks,
  days = 7,
}: {
  created: PeriodDelta;
  completed: PeriodDelta;
  avgCycleTimeHours: number;
  openTasks: number;
  days?: number;
}) {
  const period = `${days} days`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={PlusCircle}
        label="Created"
        value={String(created.current)}
        caption={`Last ${period} · ${created.previous} before`}
        badge={<DeltaBadge delta={created} period={period} />}
      />
      <MetricCard
        icon={CheckCircle2}
        label="Completed"
        value={String(completed.current)}
        caption={`Last ${period} · ${completed.previous} before`}
        badge={<DeltaBadge delta={completed} period={period} />}
      />
      <MetricCard
        icon={Timer}
        label="Average cycle time"
        value={avgCycleTimeHours > 0 ? `${avgCycleTimeHours}h` : "—"}
        caption="Creation to completion, all finished tasks"
      />
      <MetricCard
        icon={ListTodo}
        label="Open now"
        value={String(openTasks)}
        caption="To do and in progress"
      />
    </div>
  );
}
