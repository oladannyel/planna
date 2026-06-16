import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center">
      {Icon ? <Icon className="h-10 w-10 text-text-muted" aria-hidden /> : null}
      <h2 className="mt-4 text-lg font-medium">{title}</h2>
      {message ? <p className="mt-1 max-w-sm text-sm text-text-secondary">{message}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
