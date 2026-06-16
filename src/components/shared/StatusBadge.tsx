import type { TaskStatus } from "@/features/tasks/types";

import { Badge } from "./Badge";

const STYLES: Record<TaskStatus, string> = {
  todo: "bg-text-muted/20 text-text-secondary",
  in_progress: "bg-purple/20 text-purple",
  done: "bg-teal/20 text-teal",
  cancelled: "bg-text-muted/10 text-text-muted line-through",
};

const LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge className={STYLES[status]}>{LABELS[status]}</Badge>;
}
