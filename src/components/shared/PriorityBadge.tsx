import type { TaskPriority } from "@/features/tasks/types";

import type { BadgeTone } from "./Badge";
import { Badge } from "./Badge";

const TONES: Record<TaskPriority, BadgeTone> = {
  low: "neutral",
  medium: "brand",
  high: "warning",
  urgent: "danger",
};

const LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge tone={TONES[priority]}>{LABELS[priority]}</Badge>;
}
