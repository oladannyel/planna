import type { TaskStatus } from "@/features/tasks/types";

import type { BadgeTone } from "./Badge";
import { Badge } from "./Badge";

const TONES: Record<TaskStatus, BadgeTone> = {
  todo: "neutral",
  in_progress: "brand",
  done: "success",
  cancelled: "muted",
};

const LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  // Spread rather than pass `undefined`: exactOptionalPropertyTypes forbids
  // an explicit undefined for an optional prop.
  const strikethrough = status === "cancelled" ? { className: "line-through" } : {};

  return (
    <Badge tone={TONES[status]} {...strikethrough}>
      {LABELS[status]}
    </Badge>
  );
}
