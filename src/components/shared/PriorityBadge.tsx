import type { TaskPriority } from "@/features/tasks/types";

import { Badge } from "./Badge";

const STYLES: Record<TaskPriority, string> = {
  low: "bg-text-muted/20 text-text-secondary",
  medium: "bg-purple/20 text-purple",
  high: "bg-amber/20 text-amber",
  urgent: "bg-danger/20 text-danger",
};

const LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge className={STYLES[priority]}>{LABELS[priority]}</Badge>;
}
